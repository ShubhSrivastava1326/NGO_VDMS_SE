import csv
import io

from tests.conftest import API, guest_donate, make_campaign, make_event, register_donor, register_volunteer


def _util(client, admin, cid, amount, category="supplies", ref="INV-1", **over):
    body = {"category": category, "amount": amount, "description": "Bought things", "reference_number": ref}
    body.update(over)
    return client.post(f"{API}/admin/campaigns/{cid}/utilizations", json=body, headers=admin)


def test_utilization_cannot_exceed_amount_raised(client, admin):
    cid = make_campaign(client, admin)
    guest_donate(client, cid, "1000.00")

    r = _util(client, admin, cid, "600.00")
    assert r.status_code == 201
    assert r.json()["amount"] == "600.00" and r.json()["recorded_by_name"] == "NGO Admin"

    r = _util(client, admin, cid, "400.01", ref="INV-2")  # Fund.Utilization.Validate / BR-4
    assert r.status_code == 400 and r.json()["code"] == "UTILIZATION_EXCEEDS_RAISED"
    assert r.json()["errors"][0]["field"] == "amount" and "400.00" in r.json()["errors"][0]["message"]
    assert _util(client, admin, cid, "400.00", ref="INV-3").status_code == 201  # exactly the remainder is fine
    assert _util(client, admin, cid, "0.01", ref="INV-4").status_code == 400  # nothing left


def test_utilization_requires_started_campaign_and_valid_input(client, admin):
    draft = make_campaign(client, admin, publish=False)
    r = _util(client, admin, draft, "10.00")
    assert r.status_code == 409 and r.json()["code"] == "CAMPAIGN_NOT_STARTED"

    cid = make_campaign(client, admin)
    assert _util(client, admin, cid, "10.00").status_code == 400  # nothing raised yet
    assert _util(client, admin, cid, "-5").status_code == 422
    assert _util(client, admin, cid, "5", reference_number="").status_code == 422
    assert _util(client, admin, 9999, "5").status_code == 404

    guest_donate(client, cid, "100.00")
    client.post(f"{API}/admin/campaigns/{cid}/close", headers=admin)
    assert _util(client, admin, cid, "40.00").status_code == 201  # closed campaigns accept entries too


def test_fund_report_and_dashboard(client, admin):
    c1 = make_campaign(client, admin, title="One")
    c2 = make_campaign(client, admin, title="Two")
    guest_donate(client, c1, "1000.00")
    guest_donate(client, c2, "500.00", email="b@example.com", name="B")
    _util(client, admin, c1, "300.00", "supplies", "INV-1")
    _util(client, admin, c1, "100.00", "supplies", "INV-2")
    _util(client, admin, c1, "100.00", "logistics", "INV-3")

    rep = client.get(f"{API}/admin/campaigns/{c1}/fund-report", headers=admin).json()  # Fund.Report.Campaign
    assert (rep["total_raised"], rep["total_utilized"], rep["remaining_balance"]) == ("1000.00", "500.00", "500.00")
    cats = {b["category"]: b for b in rep["breakdown"]}
    assert cats["supplies"]["amount"] == "400.00" and cats["supplies"]["entries"] == 2 and cats["supplies"]["percent_of_utilized"] == 80.0
    assert cats["logistics"]["amount"] == "100.00"
    assert rep["breakdown"][0]["category"] == "supplies" and len(rep["entries"]) == 3
    assert len(client.get(f"{API}/admin/campaigns/{c1}/utilizations", headers=admin).json()) == 3

    dash = client.get(f"{API}/admin/dashboard", headers=admin).json()  # Fund.Report.Dashboard
    assert (dash["total_raised"], dash["total_utilized"], dash["total_remaining"]) == ("1500.00", "500.00", "1000.00")
    assert dash["campaigns"] == {"draft": 0, "active": 2, "closed": 0}
    assert dash["total_donors"] == 2 and len(dash["recent_donations"]) == 2


def test_fund_report_export_pdf_and_csv(client, admin):
    cid = make_campaign(client, admin)
    guest_donate(client, cid, "1000.00")
    _util(client, admin, cid, "250.00", "supplies", "INV-9", description="Notebooks, pens")

    pdf = client.get(f"{API}/admin/campaigns/{cid}/fund-report/export?format=pdf", headers=admin)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert "attachment" in pdf.headers["content-disposition"] and pdf.headers["content-disposition"].endswith('.pdf"')

    res = client.get(f"{API}/admin/campaigns/{cid}/fund-report/export?format=csv", headers=admin)
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(res.content.decode("utf-8-sig"))))
    flat = [cell for row in rows for cell in row]
    assert "1000.00" in flat and "250.00" in flat and "INV-9" in flat and "Notebooks, pens" in flat
    assert client.get(f"{API}/admin/campaigns/{cid}/fund-report/export?format=xml", headers=admin).status_code == 422

    empty = make_campaign(client, admin, title="Empty")  # report with no entries still renders
    assert client.get(f"{API}/admin/campaigns/{empty}/fund-report/export?format=pdf", headers=admin).status_code == 200


def test_fund_endpoints_are_admin_only(client, admin):
    cid = make_campaign(client, admin)
    vol, _ = register_volunteer(client, 1)
    donor, _ = register_donor(client, 1)
    for h in (vol, donor):  # SE-4 / BR-5
        assert client.post(f"{API}/admin/campaigns/{cid}/utilizations", json={}, headers=h).status_code == 403
        assert client.get(f"{API}/admin/campaigns/{cid}/fund-report", headers=h).status_code == 403
        assert client.get(f"{API}/admin/dashboard", headers=h).status_code == 403
        assert client.post(f"{API}/admin/campaigns/{cid}/close", headers=h).status_code == 403


def test_audit_trail_records_admin_and_timestamp(client, admin):
    cid = make_campaign(client, admin)
    guest_donate(client, cid, "100.00")
    _util(client, admin, cid, "40.00", "supplies", "INV-77")

    log = client.get(f"{API}/admin/audit-log?entity_type=fund_utilization", headers=admin).json()  # SE-6
    assert log["total"] == 1
    entry = log["items"][0]
    assert entry["action"] == "fund.utilization" and entry["user_id"] == 1 and entry["created_at"]
    assert entry["details"]["amount"] == "40.00" and entry["details"]["reference_number"] == "INV-77"
    actions = {e["action"] for e in client.get(f"{API}/admin/audit-log", headers=admin).json()["items"]}
    assert {"campaign.create", "campaign.publish", "fund.utilization"} <= actions


def test_money_is_exact_to_two_decimals(client, admin):
    cid = make_campaign(client, admin, goal="100000.00")
    for _ in range(3):  # 0.10 * 3 would be 0.30000000000000004 as a float
        guest_donate(client, cid, "0.10")
    assert client.get(f"{API}/campaigns/{cid}").json()["amount_raised"] == "0.30"  # CO-3
    guest_donate(client, cid, 19.99, email="x@example.com", name="X")  # JSON numbers are accepted too
    assert client.get(f"{API}/campaigns/{cid}").json()["amount_raised"] == "20.29"


def test_meta_health_and_error_shapes(client):
    cfg = client.get(f"{API}/meta/config").json()
    assert cfg["currency"] == "INR" and cfg["max_single_donation"] == "100000.00"
    assert cfg["payment_methods"] == ["card", "upi", "net_banking"]
    assert cfg["campaign_statuses"] == ["draft", "active", "closed"]
    faq = client.get(f"{API}/meta/faq").json()
    assert {i["topic"] for i in faq} == {"Donating", "Volunteering"}  # 2.6
    assert client.get("/health").json() == {"status": "ok"}

    r = client.get(f"{API}/campaigns/999999")
    assert r.status_code == 404 and r.json() == {"detail": "Campaign not found", "code": "NOT_FOUND"}
    r = client.get(f"{API}/does-not-exist")
    assert r.status_code == 404 and r.json()["code"] == "NOT_FOUND"
    r = client.get(f"{API}/campaigns?page=0")
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "page"


def test_cors_allows_the_frontend_origin(client):
    r = client.options(
        f"{API}/auth/login",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"},
    )
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "http://localhost:5173"
    r = client.get(f"{API}/meta/config", headers={"Origin": "http://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_maintenance_job_closes_due_campaigns_and_completes_events(client, admin, db, monkeypatch):
    from datetime import timedelta

    from app.core.clock import local_today, utcnow
    from app.main import run_maintenance
    from app.models import Campaign, Event
    import app.services.campaigns as campaigns_service

    cid = make_campaign(client, admin)
    eid = make_event(client, admin)
    db.get(Event, eid).event_date = utcnow() - timedelta(hours=1)
    db.commit()
    monkeypatch.setattr(campaigns_service, "local_today", lambda: local_today() + timedelta(days=365))

    run_maintenance()
    db.expire_all()
    assert db.get(Campaign, cid).status.value == "closed"
    assert db.get(Event, eid).status.value == "completed"
