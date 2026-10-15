from datetime import timedelta

from app.core.clock import local_today
from tests.conftest import API, guest_donate, make_campaign


def _body(**over):
    today = local_today()
    body = {
        "title": "Flood Relief",
        "description": "Emergency supplies.",
        "category": "disaster relief",
        "goal_amount": "50000.00",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=10)).isoformat(),
    }
    body.update(over)
    return body


def test_create_starts_as_draft_and_hidden_from_public(client, admin):
    cid = make_campaign(client, admin, publish=False)
    c = client.get(f"{API}/admin/campaigns/{cid}", headers=admin).json()
    assert c["status"] == "draft" and c["amount_raised"] == "0.00" and c["goal_amount"] == "10000.00"

    assert client.get(f"{API}/campaigns").json()["items"] == []  # Campaign.View.Active: only active
    assert client.get(f"{API}/campaigns/{cid}").status_code == 404  # draft hidden from public
    assert client.get(f"{API}/campaigns/{cid}", headers=admin).status_code == 200  # but not from admin


def test_create_validation(client, admin):
    today = local_today()
    r = client.post(f"{API}/admin/campaigns", json=_body(end_date=today.isoformat()), headers=admin)
    assert r.status_code == 422
    assert any(e["field"] == "end_date" for e in r.json()["errors"])

    for bad_goal in ("0", "-5", "10.555"):
        r = client.post(f"{API}/admin/campaigns", json=_body(goal_amount=bad_goal), headers=admin)
        assert r.status_code == 422, bad_goal
        assert any(e["field"] == "goal_amount" for e in r.json()["errors"])


def test_publish_makes_campaign_public_and_is_one_way(client, admin):
    cid = make_campaign(client, admin, publish=False)
    r = client.post(f"{API}/admin/campaigns/{cid}/publish", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "active" and r.json()["published_at"]

    listing = client.get(f"{API}/campaigns").json()
    assert listing["total"] == 1 and listing["items"][0]["campaign_id"] == cid
    assert client.post(f"{API}/admin/campaigns/{cid}/publish", headers=admin).status_code == 409


def test_public_listing_filters_search_sort_and_pagination(client, admin):
    make_campaign(client, admin, title="Books for Kids", category="education")
    make_campaign(client, admin, title="Mobile Clinic", category="healthcare", end_date=(local_today() + timedelta(days=5)).isoformat())
    make_campaign(client, admin, title="Draft only", publish=False)

    assert client.get(f"{API}/campaigns").json()["total"] == 2
    assert client.get(f"{API}/campaigns?category=healthcare").json()["total"] == 1
    found = client.get(f"{API}/campaigns?q=CLINIC").json()  # case-insensitive, matches title
    assert found["total"] == 1 and found["items"][0]["title"] == "Mobile Clinic"
    assert client.get(f"{API}/campaigns?q=notebooks").json()["total"] == 2  # also searches description
    assert client.get(f"{API}/campaigns?sort=ending_soon").json()["items"][0]["title"] == "Mobile Clinic"
    page = client.get(f"{API}/campaigns?page_size=1&page=2").json()
    assert len(page["items"]) == 1 and page["pages"] == 2
    assert sorted(client.get(f"{API}/campaigns/categories").json()) == ["education", "healthcare"]


def test_edit_rules_draft_vs_active(client, admin):
    cid = make_campaign(client, admin, publish=False)
    r = client.patch(f"{API}/admin/campaigns/{cid}", json={"goal_amount": "20000.00", "title": "New title"}, headers=admin)
    assert r.status_code == 200 and r.json()["goal_amount"] == "20000.00"

    client.post(f"{API}/admin/campaigns/{cid}/publish", headers=admin)
    # Campaign.Edit: goal locked once Active
    r = client.patch(f"{API}/admin/campaigns/{cid}", json={"goal_amount": "99999.00"}, headers=admin)
    assert r.status_code == 409 and r.json()["code"] == "CAMPAIGN_FIELD_LOCKED"
    # description and end date remain editable
    new_end = (local_today() + timedelta(days=60)).isoformat()
    r = client.patch(f"{API}/admin/campaigns/{cid}", json={"description": "Updated", "end_date": new_end}, headers=admin)
    assert r.status_code == 200 and r.json()["end_date"] == new_end and r.json()["description"] == "Updated"
    # sending the unchanged goal back (a whole-form PATCH) is fine
    r = client.patch(f"{API}/admin/campaigns/{cid}", json={"goal_amount": "20000.00", "description": "Again"}, headers=admin)
    assert r.status_code == 200


def test_manual_close_stops_donations_and_blocks_edits(client, admin):
    cid = make_campaign(client, admin)
    r = client.post(f"{API}/admin/campaigns/{cid}/close", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "closed" and r.json()["closed_reason"] == "manual"

    r = client.post(
        f"{API}/donations",
        json={"campaign_id": cid, "amount": "100", "payment_method": "card", "donor": {"name": "A", "email": "a@example.com"}},
    )
    assert r.status_code == 409 and r.json()["code"] == "CAMPAIGN_NOT_ACTIVE"  # BR-3
    assert client.patch(f"{API}/admin/campaigns/{cid}", json={"description": "x"}, headers=admin).status_code == 409
    assert client.post(f"{API}/admin/campaigns/{cid}/close", headers=admin).status_code == 409
    assert client.get(f"{API}/campaigns").json()["total"] == 0


def test_auto_close_when_end_date_passes(client, admin, monkeypatch):
    today = local_today()
    cid = make_campaign(client, admin, end_date=(today + timedelta(days=1)).isoformat())
    assert client.get(f"{API}/campaigns/{cid}").json()["status"] == "active"

    import app.services.campaigns as campaigns_service

    monkeypatch.setattr(campaigns_service, "local_today", lambda: today + timedelta(days=2))
    assert client.get(f"{API}/campaigns").json()["total"] == 0  # listing syncs first
    c = client.get(f"{API}/campaigns/{cid}").json()
    assert c["status"] == "closed" and c["closed_reason"] == "end_date_passed"


def test_auto_close_when_goal_reached(client, admin):
    cid = make_campaign(client, admin, goal="1000.00")
    guest_donate(client, cid, "400.00")
    mid = client.get(f"{API}/campaigns/{cid}").json()
    assert mid["status"] == "active" and mid["amount_raised"] == "400.00"
    assert mid["progress_percent"] == 40.0 and mid["amount_remaining"] == "600.00"

    guest_donate(client, cid, "600.00", email="b@example.com", name="B")
    done = client.get(f"{API}/campaigns/{cid}").json()
    assert done["status"] == "closed" and done["closed_reason"] == "goal_reached"
    assert done["amount_raised"] == "1000.00" and done["progress_percent"] == 100.0


def test_cannot_publish_campaign_whose_end_date_has_passed(client, admin, monkeypatch):
    cid = make_campaign(client, admin, publish=False)
    import app.services.campaigns as campaigns_service

    monkeypatch.setattr(campaigns_service, "local_today", lambda: local_today() + timedelta(days=90))
    r = client.post(f"{API}/admin/campaigns/{cid}/publish", headers=admin)
    assert r.status_code == 400 and r.json()["code"] == "INVALID_DATES"
