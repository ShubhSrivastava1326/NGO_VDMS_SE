from datetime import timedelta

from sqlalchemy import select

from app.core.clock import utcnow
from app.models import EmailLog, Event
from tests.conftest import API, make_event, register_volunteer


def _push_event_into_past(db, event_id, hours=2):
    ev = db.get(Event, event_id)
    ev.event_date = utcnow() - timedelta(hours=hours)
    db.commit()


# --- Volunteer registration & approval (3.1) -------------------------------------------------------
def test_pending_volunteer_cannot_sign_up_until_approved(client, admin):
    eid = make_event(client, admin)
    vol, vid = register_volunteer(client, 1)

    r = client.post(f"{API}/events/{eid}/signup", headers=vol)
    assert r.status_code == 403 and r.json()["code"] == "VOLUNTEER_NOT_APPROVED"  # BR-6

    pending = client.get(f"{API}/admin/volunteers?status=pending", headers=admin).json()
    assert pending["total"] == 1 and pending["items"][0]["volunteer_id"] == vid

    assert client.post(f"{API}/admin/volunteers/{vid}/approve", headers=admin).json()["status"] == "approved"
    assert client.post(f"{API}/admin/volunteers/{vid}/approve", headers=admin).status_code == 409
    assert client.post(f"{API}/events/{eid}/signup", headers=vol).status_code == 201
    assert client.get(f"{API}/auth/me", headers=vol).json()["volunteer_status"] == "approved"


def test_deactivated_volunteer_cannot_sign_up_for_new_events(client, admin):
    vol, vid = register_volunteer(client, 1, approve_with=admin)
    e1, e2 = make_event(client, admin), make_event(client, admin, title="Second")
    assert client.post(f"{API}/events/{e1}/signup", headers=vol).status_code == 201

    r = client.post(f"{API}/admin/volunteers/{vid}/deactivate", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "deactivated"
    r = client.post(f"{API}/events/{e2}/signup", headers=vol)
    assert r.status_code == 403 and r.json()["code"] == "VOLUNTEER_NOT_APPROVED"
    assert client.get(f"{API}/volunteers/me", headers=vol).status_code == 200  # can still log in / view

    assert client.post(f"{API}/admin/volunteers/{vid}/approve", headers=admin).status_code == 200  # re-activate
    assert client.post(f"{API}/events/{e2}/signup", headers=vol).status_code == 201


def test_volunteer_profile_edit_and_admin_view(client, admin):
    vol, vid = register_volunteer(client, 1, approve_with=admin)
    register_volunteer(client, 2)
    r = client.patch(
        f"{API}/volunteers/me",
        json={"phone_number": "+91 91111 22222", "availability": "Weekday evenings", "areas_of_interest": ["teaching", "medical aid"]},
        headers=vol,
    )
    assert r.status_code == 200
    me = r.json()
    assert me["phone_number"] == "+919111122222" and me["areas_of_interest"] == ["teaching", "medical aid"]
    # can't take another volunteer's phone number
    r = client.patch(f"{API}/volunteers/me", json={"phone_number": "+919000000002"}, headers=vol)
    assert r.status_code == 409 and r.json()["code"] == "PHONE_ALREADY_REGISTERED"

    eid = make_event(client, admin)
    client.post(f"{API}/events/{eid}/signup", headers=vol)
    detail = client.get(f"{API}/admin/volunteers/{vid}", headers=admin).json()  # Volunteer.Profile.View
    assert detail["availability"] == "Weekday evenings" and len(detail["assignment_history"]) == 1
    assert client.get(f"{API}/admin/volunteers?q=vol2", headers=admin).json()["total"] == 1
    assert client.get(f"{API}/admin/volunteers?status=approved", headers=admin).json()["total"] == 1
    assert client.get(f"{API}/admin/volunteers/9999", headers=admin).status_code == 404


# --- Event lifecycle (3.5) -----------------------------------------------------------------------------
def test_event_creation_validation_and_visibility(client, admin):
    r = client.post(
        f"{API}/admin/events",
        json={"title": "Past", "description": "d", "event_date": (utcnow() - timedelta(days=1)).isoformat(), "location": "x", "volunteers_required": 2},
        headers=admin,
    )
    assert r.status_code == 400 and r.json()["code"] == "EVENT_DATE_IN_PAST"
    r = client.post(
        f"{API}/admin/events",
        json={"title": "Zero", "description": "d", "event_date": (utcnow() + timedelta(days=1)).isoformat(), "location": "x", "volunteers_required": 0},
        headers=admin,
    )
    assert r.status_code == 422

    draft = make_event(client, admin, publish=False)
    live = make_event(client, admin, title="Visible")
    public = client.get(f"{API}/events").json()  # Event.Publish: only published events are visible
    assert [e["event_id"] for e in public["items"]] == [live]
    assert client.get(f"{API}/events/{draft}").status_code == 404
    assert client.get(f"{API}/events/{draft}", headers=admin).status_code == 200
    assert client.get(f"{API}/admin/events?status=draft", headers=admin).json()["total"] == 1


def test_naive_event_datetime_is_read_as_local_time_and_returned_as_utc(client, admin):
    r = client.post(
        f"{API}/admin/events",
        json={"title": "T", "description": "d", "event_date": "2099-01-01T10:00:00", "location": "x", "volunteers_required": 1},
        headers=admin,
    )
    assert r.status_code == 201
    # 10:00 Asia/Kolkata (UTC+5:30) == 04:30 UTC, serialised with an explicit UTC marker
    assert r.json()["event_date"] in ("2099-01-01T04:30:00Z", "2099-01-01T04:30:00+00:00")


def test_signup_slots_full_and_withdraw(client, admin):
    eid = make_event(client, admin, slots=2)
    vols = [register_volunteer(client, n, approve_with=admin)[0] for n in (1, 2, 3)]

    ev = client.get(f"{API}/events/{eid}").json()
    assert ev["volunteers_required"] == 2 and ev["registered_count"] == 0 and ev["slots_remaining"] == 2 and not ev["is_full"]

    assert client.post(f"{API}/events/{eid}/signup", headers=vols[0]).status_code == 201
    r = client.post(f"{API}/events/{eid}/signup", headers=vols[0])
    assert r.status_code == 409 and r.json()["code"] == "ALREADY_REGISTERED"
    assert client.post(f"{API}/events/{eid}/signup", headers=vols[1]).status_code == 201

    r = client.post(f"{API}/events/{eid}/signup", headers=vols[2])  # Event.Signup.Full
    assert r.status_code == 409 and r.json()["code"] == "EVENT_FULL"
    ev = client.get(f"{API}/events/{eid}").json()
    assert ev["is_full"] and ev["slots_remaining"] == 0 and ev["registered_count"] == 2

    # withdrawing frees the slot
    assert client.delete(f"{API}/events/{eid}/signup", headers=vols[0]).status_code == 200
    assert client.delete(f"{API}/events/{eid}/signup", headers=vols[0]).status_code == 404
    assert client.post(f"{API}/events/{eid}/signup", headers=vols[2]).status_code == 201


def test_event_listing_shows_my_registration_to_volunteers(client, admin):
    eid = make_event(client, admin)
    vol, _ = register_volunteer(client, 1, approve_with=admin)
    client.post(f"{API}/events/{eid}/signup", headers=vol)
    mine = client.get(f"{API}/events", headers=vol).json()["items"][0]
    assert mine["my_registration"]["attendance_status"] == "registered"
    assert client.get(f"{API}/events").json()["items"][0]["my_registration"] is None  # anonymous


def test_signup_requires_published_future_event(client, admin, db):
    vol, _ = register_volunteer(client, 1, approve_with=admin)
    draft = make_event(client, admin, publish=False)
    assert client.post(f"{API}/events/{draft}/signup", headers=vol).json()["code"] == "EVENT_NOT_OPEN"
    live = make_event(client, admin)
    _push_event_into_past(db, live)
    assert client.post(f"{API}/events/{live}/signup", headers=vol).json()["code"] == "EVENT_PASSED"
    assert client.post(f"{API}/events/9999/signup", headers=vol).status_code == 404


def test_task_assignment_and_volunteer_task_view(client, admin):
    eid = make_event(client, admin)
    vol, vid = register_volunteer(client, 1, approve_with=admin)
    reg_id = client.post(f"{API}/events/{eid}/signup", headers=vol).json()["registration_id"]

    r = client.patch(f"{API}/admin/events/{eid}/registrations/{reg_id}", json={"task": "registration desk"}, headers=admin)
    assert r.status_code == 200 and r.json()["task"] == "registration desk"  # Event.Task.Assign

    tasks = client.get(f"{API}/volunteers/me/tasks", headers=vol).json()  # Volunteer.Task.View
    assert len(tasks) == 1 and tasks[0]["task"] == "registration desk" and tasks[0]["event"]["event_id"] == eid

    roster = client.get(f"{API}/admin/events/{eid}/registrations", headers=admin).json()
    assert roster[0]["volunteer"]["volunteer_id"] == vid and roster[0]["task"] == "registration desk"

    r = client.patch(f"{API}/admin/events/{eid}/registrations/{reg_id}", json={"task": ""}, headers=admin)
    assert r.json()["task"] is None
    assert client.patch(f"{API}/admin/events/{eid}/registrations/{reg_id}", json={}, headers=admin).status_code == 422
    assert client.patch(f"{API}/admin/events/{eid}/registrations/9999", json={"task": "x"}, headers=admin).status_code == 404


def test_attendance_only_after_event_date(client, admin, db):
    eid = make_event(client, admin, slots=3)
    v1, _ = register_volunteer(client, 1, approve_with=admin)
    v2, _ = register_volunteer(client, 2, approve_with=admin)
    r1 = client.post(f"{API}/events/{eid}/signup", headers=v1).json()["registration_id"]
    r2 = client.post(f"{API}/events/{eid}/signup", headers=v2).json()["registration_id"]

    r = client.post(
        f"{API}/admin/events/{eid}/attendance",
        json={"records": [{"registration_id": r1, "attendance_status": "attended"}]},
        headers=admin,
    )
    assert r.status_code == 409 and r.json()["code"] == "ATTENDANCE_NOT_ALLOWED"  # event is still in the future

    _push_event_into_past(db, eid)
    r = client.post(
        f"{API}/admin/events/{eid}/attendance",
        json={"records": [
            {"registration_id": r1, "attendance_status": "attended"},
            {"registration_id": r2, "attendance_status": "no_show"},
        ]},
        headers=admin,
    )
    assert r.status_code == 200 and {x["attendance_status"] for x in r.json()} == {"attended", "no_show"}  # Event.Attendance.Mark
    assert client.get(f"{API}/admin/events/{eid}", headers=admin).json()["status"] == "completed"

    history = client.get(f"{API}/volunteers/me/history", headers=v1).json()  # Event.History.View
    assert len(history) == 1 and history[0]["attendance_status"] == "attended"
    assert client.get(f"{API}/volunteers/me/tasks", headers=v1).json() == []  # past events are not 'current'
    assert client.get(f"{API}/volunteers/me/dashboard", headers=v1).json()["events_attended"] == 1


def test_cancel_event_notifies_signed_up_volunteers(client, admin, db):
    eid = make_event(client, admin)
    for n in (1, 2):
        vol, _ = register_volunteer(client, n, approve_with=admin)
        client.post(f"{API}/events/{eid}/signup", headers=vol)

    r = client.post(f"{API}/admin/events/{eid}/cancel", headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    sent = db.scalars(select(EmailLog).where(EmailLog.kind == "event_cancelled")).all()  # Event.Cancel + CI-2
    assert sorted(m.to_email for m in sent) == ["vol1@example.com", "vol2@example.com"]
    assert len(db.scalars(select(EmailLog).where(EmailLog.kind == "event_signup")).all()) == 2

    assert client.get(f"{API}/events").json()["items"] == []  # no longer listed for sign-up
    assert client.post(f"{API}/admin/events/{eid}/cancel", headers=admin).status_code == 409
    vol3, _ = register_volunteer(client, 3, approve_with=admin)
    assert client.post(f"{API}/events/{eid}/signup", headers=vol3).json()["code"] == "EVENT_NOT_OPEN"


def test_edit_event_respects_registered_count(client, admin):
    eid = make_event(client, admin, slots=3)
    for n in (1, 2):
        vol, _ = register_volunteer(client, n, approve_with=admin)
        client.post(f"{API}/events/{eid}/signup", headers=vol)
    r = client.patch(f"{API}/admin/events/{eid}", json={"volunteers_required": 1}, headers=admin)
    assert r.status_code == 400 and r.json()["code"] == "SLOTS_BELOW_REGISTERED"
    r = client.patch(f"{API}/admin/events/{eid}", json={"volunteers_required": 5, "location": "New hall"}, headers=admin)
    assert r.status_code == 200 and r.json()["slots_remaining"] == 3 and r.json()["location"] == "New hall"


def test_volunteer_dashboard(client, admin):
    vol, _ = register_volunteer(client, 1, approve_with=admin)
    e1 = make_event(client, admin, title="One")
    make_event(client, admin, title="Two", days=9)
    client.post(f"{API}/events/{e1}/signup", headers=vol)
    dash = client.get(f"{API}/volunteers/me/dashboard", headers=vol).json()
    assert dash["volunteer"]["status"] == "approved"
    assert [a["event"]["title"] for a in dash["upcoming_assignments"]] == ["One"]
    assert len(dash["open_events"]) == 2 and dash["open_events"][0]["my_registration"] is not None
