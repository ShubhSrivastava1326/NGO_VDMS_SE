from sqlalchemy import select

from app.models import Donor, EmailLog
from tests.conftest import API, auth_header, guest_donate, make_campaign, register_donor


def _init(client, cid, amount="500.00", headers=None, **over):
    body = {"campaign_id": cid, "amount": amount, "payment_method": "upi", "donor": {"name": "Guest Giver", "email": "guest@example.com"}}
    body.update(over)
    return client.post(f"{API}/donations", json=body, headers=headers or {})


def test_guest_donation_full_flow_updates_total_and_issues_receipt(client, admin, db):
    cid = make_campaign(client, admin)

    r = _init(client, cid, "1500.50", pan_tax_id="abcde1234f")
    assert r.status_code == 201
    init = r.json()
    assert init["donation"]["status"] == "pending"  # BR-2
    assert init["confirmation"] == {  # Donation.Confirm summary
        "campaign_title": "School Supplies Drive",
        "amount": "1500.50",
        "payment_method": "upi",
        "donor_name": "Guest Giver",
    }
    did, token = init["donation"]["donation_id"], init["access_token"]
    # pending donations do not count yet
    assert client.get(f"{API}/campaigns/{cid}").json()["amount_raised"] == "0.00"

    r = client.post(f"{API}/donations/{did}/confirm", headers={"X-Donation-Token": token})
    assert r.status_code == 200
    done = r.json()
    assert done["status"] == "completed" and done["receipt_number"].startswith("RCP-")
    assert client.get(f"{API}/campaigns/{cid}").json()["amount_raised"] == "1500.50"  # Campaign.Progress.Update

    receipt = client.get(f"{API}/donations/{did}/receipt", headers={"X-Donation-Token": token}).json()
    assert receipt["receipt_number"] == done["receipt_number"]
    assert receipt["donor_name"] == "Guest Giver" and receipt["amount"] == "1500.50"
    assert receipt["campaign_title"] == "School Supplies Drive" and receipt["pan_tax_id"] == "ABCDE1234F"

    pdf = client.get(f"{API}/donations/{did}/receipt.pdf?token={token}")  # query-token for plain download links
    assert pdf.status_code == 200 and pdf.headers["content-type"] == "application/pdf" and pdf.content.startswith(b"%PDF")

    mails = db.scalars(select(EmailLog).where(EmailLog.kind == "donation_receipt")).all()  # Donation.Receipt.Email
    assert len(mails) == 1 and mails[0].to_email == "guest@example.com" and mails[0].status == "skipped"


def test_failed_payment_does_not_change_total_and_can_be_retried(client, admin):
    cid = make_campaign(client, admin)
    failed, token = guest_donate(client, cid, "300.00", outcome="failure")
    assert failed["status"] == "failed" and failed["failure_reason"] and failed["receipt_number"] is None
    assert client.get(f"{API}/campaigns/{cid}").json()["amount_raised"] == "0.00"  # Donation.Process.Failure

    # receipt not available for failed donations
    r = client.get(f"{API}/donations/{failed['donation_id']}/receipt", headers={"X-Donation-Token": token})
    assert r.status_code == 409 and r.json()["code"] == "RECEIPT_NOT_AVAILABLE"

    # Fig. 4: retry creates a NEW pending attempt
    r = client.post(f"{API}/donations/{failed['donation_id']}/retry", headers={"X-Donation-Token": token})
    assert r.status_code == 201
    retry = r.json()
    assert retry["donation"]["status"] == "pending" and retry["donation"]["retry_of_id"] == failed["donation_id"]
    assert retry["donation"]["donation_id"] != failed["donation_id"] and retry["access_token"] != token

    r = client.post(
        f"{API}/donations/{retry['donation']['donation_id']}/confirm",
        json={"simulate_outcome": "success"},
        headers={"X-Donation-Token": retry["access_token"]},
    )
    assert r.json()["status"] == "completed"
    assert client.get(f"{API}/campaigns/{cid}").json()["amount_raised"] == "300.00"

    # a completed donation cannot be retried
    r = client.post(f"{API}/donations/{r.json()['donation_id']}/retry", headers={"X-Donation-Token": retry["access_token"]})
    assert r.status_code == 409 and r.json()["code"] == "DONATION_NOT_FAILED"


def test_cancel_pending_donation(client, admin):
    cid = make_campaign(client, admin)
    init = _init(client, cid).json()
    h = {"X-Donation-Token": init["access_token"]}
    r = client.post(f"{API}/donations/{init['donation']['donation_id']}/cancel", headers=h)
    assert r.status_code == 200 and r.json()["status"] == "failed" and r.json()["failure_reason"] == "Cancelled by donor"
    # cannot confirm after cancelling
    r = client.post(f"{API}/donations/{init['donation']['donation_id']}/confirm", headers=h)
    assert r.status_code == 409 and r.json()["code"] == "DONATION_NOT_PENDING"


def test_double_confirm_is_rejected_and_counts_once(client, admin):
    cid = make_campaign(client, admin)
    done, token = guest_donate(client, cid, "250.00")
    r = client.post(f"{API}/donations/{done['donation_id']}/confirm", headers={"X-Donation-Token": token})
    assert r.status_code == 409 and r.json()["code"] == "DONATION_NOT_PENDING"
    assert client.get(f"{API}/campaigns/{cid}").json()["amount_raised"] == "250.00"


def test_amount_validation(client, admin):
    cid = make_campaign(client, admin)
    for bad in ("0", "-10", "12.345", "abc"):
        r = _init(client, cid, bad)
        assert r.status_code == 422, bad
        assert any(e["field"] == "amount" for e in r.json()["errors"]), bad
    r = _init(client, cid, "100000.01")  # test config limit is 100000.00 (TBD-1: configurable)
    assert r.status_code == 400 and r.json()["code"] == "DONATION_LIMIT_EXCEEDED"
    assert _init(client, cid, "100000.00").status_code == 201


def test_guest_must_supply_details_and_campaign_must_be_active(client, admin):
    cid = make_campaign(client, admin)
    r = client.post(f"{API}/donations", json={"campaign_id": cid, "amount": "10", "payment_method": "card"})
    assert r.status_code == 400 and r.json()["code"] == "DONOR_DETAILS_REQUIRED"

    draft = make_campaign(client, admin, publish=False)
    r = _init(client, draft)
    assert r.status_code == 409 and r.json()["code"] == "CAMPAIGN_NOT_ACTIVE"
    assert _init(client, 9999).status_code == 404


def test_payment_method_must_be_known(client, admin):
    cid = make_campaign(client, admin)
    assert _init(client, cid, payment_method="bitcoin").status_code == 422
    for m in ("card", "upi", "net_banking"):
        assert _init(client, cid, payment_method=m).status_code == 201


def test_access_control_on_flow_endpoints(client, admin):
    cid = make_campaign(client, admin)
    init = _init(client, cid).json()
    did = init["donation"]["donation_id"]

    assert client.post(f"{API}/donations/{did}/confirm").status_code == 401  # no token, no login
    r = client.post(f"{API}/donations/{did}/confirm", headers={"X-Donation-Token": "wrong"})
    assert r.status_code == 403
    other, _ = register_donor(client, 2)
    assert client.post(f"{API}/donations/{did}/confirm", headers=other).status_code == 403
    assert client.get(f"{API}/donations/{did}", headers=admin).status_code == 200  # admin may view
    assert client.post(f"{API}/donations/{did}/confirm", headers=admin).status_code == 403  # but not act


def test_registered_donor_flow_and_history_privacy(client, admin):
    cid = make_campaign(client, admin)
    me, donor_id = register_donor(client, 1)

    # logged-in donors don't need to send donor details; profile is used
    r = client.post(f"{API}/donations", json={"campaign_id": cid, "amount": "700", "payment_method": "card"}, headers=me)
    assert r.status_code == 201 and r.json()["donation"]["donor_id"] == donor_id
    did = r.json()["donation"]["donation_id"]
    r = client.post(f"{API}/donations/{did}/confirm", json={"simulate_outcome": "success"}, headers=me)  # JWT instead of token
    assert r.json()["status"] == "completed"

    hist = client.get(f"{API}/donors/me/donations", headers=me).json()  # Donation.History.View
    assert hist["total"] == 1 and hist["items"][0]["donation_id"] == did
    assert client.get(f"{API}/donors/me/donations?status=failed", headers=me).json()["total"] == 0

    other, _ = register_donor(client, 2)  # SE-5
    assert client.get(f"{API}/donors/me/donations", headers=other).json()["total"] == 0
    assert client.get(f"{API}/donations/{did}", headers=other).status_code == 403
    assert client.get(f"{API}/donations/{did}/receipt", headers=other).status_code == 403
    assert client.get(f"{API}/donations/{did}/receipt", headers=me).status_code == 200

    me_profile = client.get(f"{API}/donors/me", headers=me).json()
    assert me_profile["total_donated"] == "700.00" and me_profile["donation_count"] == 1
    dash = client.get(f"{API}/donors/me/dashboard", headers=me).json()
    assert len(dash["recent_donations"]) == 1 and dash["featured_campaigns"][0]["campaign_id"] == cid


def test_donor_record_auto_created_once_per_guest(client, admin, db):
    cid = make_campaign(client, admin)
    guest_donate(client, cid, "100.00")
    guest_donate(client, cid, "200.00")  # same name + e-mail -> same donor record
    guest_donate(client, cid, "50.00", name="Someone Else", email="else@example.com")
    donors = db.scalars(select(Donor)).all()
    assert len(donors) == 2 and not any(d.is_registered for d in donors)  # Donor.Record.Create

    listing = client.get(f"{API}/admin/donors", headers=admin).json()
    totals = {d["email"]: d["total_donated"] for d in listing["items"]}
    assert totals == {"guest@example.com": "300.00", "else@example.com": "50.00"}


def test_admin_donor_search_and_detail(client, admin):
    c1 = make_campaign(client, admin, title="Camp One")
    c2 = make_campaign(client, admin, title="Camp Two")
    guest_donate(client, c1, "100.00", name="Priya Nair", email="priya@example.com")
    guest_donate(client, c1, "150.00", name="Priya Nair", email="priya@example.com")
    guest_donate(client, c2, "75.00", name="Priya Nair", email="priya@example.com")
    guest_donate(client, c2, "20.00", name="Ravi K", email="ravi@example.com")

    assert client.get(f"{API}/admin/donors?q=priya", headers=admin).json()["total"] == 1  # by name
    assert client.get(f"{API}/admin/donors?q=RAVI@", headers=admin).json()["total"] == 1  # by e-mail
    assert client.get(f"{API}/admin/donors?q=nobody", headers=admin).json()["total"] == 0

    donor_id = client.get(f"{API}/admin/donors?q=priya", headers=admin).json()["items"][0]["donor_id"]
    detail = client.get(f"{API}/admin/donors/{donor_id}", headers=admin).json()  # Donor.Record.View
    assert detail["total_donated"] == "325.00" and detail["donation_count"] == 3
    by = {c["campaign_title"]: c for c in detail["by_campaign"]}
    assert by["Camp One"]["total_amount"] == "250.00" and by["Camp One"]["donation_count"] == 2
    assert by["Camp Two"]["total_amount"] == "75.00"
    assert len(detail["donations"]) == 3


def test_duplicate_donor_flag_and_merge(client, admin):
    cid = make_campaign(client, admin)
    reg_headers, reg_id = register_donor(client, 1)  # registered donor1@example.com
    guest_donate(client, cid, "100.00", name="Donor One", email="donor1@example.com")  # guest, same e-mail
    guest_donate(client, cid, "40.00", name="D. One", email="DONOR1@example.com")  # another guest, same e-mail

    groups = client.get(f"{API}/admin/donors/duplicates", headers=admin).json()  # Donor.Merge.Flag
    assert len(groups) == 1 and groups[0]["email"] == "donor1@example.com" and len(groups[0]["donors"]) == 3

    guest_ids = [d["donor_id"] for d in groups[0]["donors"] if not d["is_registered"]]
    # a registered donor can never be merged away
    r = client.post(f"{API}/admin/donors/merge", json={"primary_donor_id": guest_ids[0], "duplicate_donor_ids": [reg_id]}, headers=admin)
    assert r.status_code == 409 and r.json()["code"] == "CANNOT_MERGE_REGISTERED"

    r = client.post(f"{API}/admin/donors/merge", json={"primary_donor_id": reg_id, "duplicate_donor_ids": guest_ids}, headers=admin)
    assert r.status_code == 200 and r.json()["total_donated"] == "140.00" and r.json()["donation_count"] == 2
    assert client.get(f"{API}/admin/donors/duplicates", headers=admin).json() == []
    # the registered donor now sees the merged history
    assert client.get(f"{API}/donors/me/donations", headers=reg_headers).json()["total"] == 2


def test_admin_donation_list_filters(client, admin):
    cid = make_campaign(client, admin)
    guest_donate(client, cid, "10.00")
    guest_donate(client, cid, "20.00", outcome="failure")
    assert client.get(f"{API}/admin/donations", headers=admin).json()["total"] == 2
    assert client.get(f"{API}/admin/donations?status=completed", headers=admin).json()["total"] == 1
    assert client.get(f"{API}/admin/donations?campaign_id={cid}&status=failed", headers=admin).json()["total"] == 1
    assert client.get(f"{API}/admin/donations", headers=auth_header("x")).status_code == 401


def test_donor_profile_update(client):
    me, _ = register_donor(client, 1)
    r = client.patch(f"{API}/donors/me", json={"name": "Renamed Donor", "phone_number": "+91 99999 11111"}, headers=me)
    assert r.status_code == 200 and r.json()["name"] == "Renamed Donor" and r.json()["phone_number"] == "+919999911111"
    assert client.get(f"{API}/auth/me", headers=me).json()["full_name"] == "Renamed Donor"
