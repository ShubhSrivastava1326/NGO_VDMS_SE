import os
import tempfile
from datetime import timedelta

# Must be set before the app is imported (settings are read at import time).
_TMP = tempfile.mkdtemp(prefix="vdms-tests-")
os.environ.update(
    DATABASE_URL=f"sqlite:///{_TMP}/test.db",
    ENV="test",
    BACKGROUND_JOBS_ENABLED="false",
    PAYMENT_FAILURE_RATE="0",
    PAYMENT_ALLOW_FORCED_OUTCOME="true",
    SMTP_HOST="",
    ADMIN_EMAIL="admin@ngo.org",
    ADMIN_PASSWORD="Admin@12345",
    MAX_SINGLE_DONATION="100000.00",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.clock import local_today, utcnow  # noqa: E402
from app.db.session import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.auth import ensure_initial_admin  # noqa: E402

API = "/api/v1"


@pytest.fixture()
def client():
    from app import models  # noqa: F401

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_initial_admin(db)
    # No `with`: skip lifespan (no background loop); BackgroundTasks still run inline.
    return TestClient(app)


@pytest.fixture()
def db():
    with SessionLocal() as session:
        yield session


# --- helpers -----------------------------------------------------------------------------
def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def login(client, email, password) -> dict:
    r = client.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return auth_header(r.json()["access_token"])


@pytest.fixture()
def admin(client):
    return login(client, "admin@ngo.org", "Admin@12345")


def register_volunteer(client, n=1, approve_with=None, **over):
    body = {
        "name": f"Volunteer {n}",
        "email": f"vol{n}@example.com",
        "password": "Passw0rdX",
        "phone_number": f"+91900000{n:04d}",
        "areas_of_interest": ["logistics"],
    }
    body.update(over)
    r = client.post(f"{API}/auth/register/volunteer", json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    headers = auth_header(data["access_token"])
    vid = data["user"]["volunteer_id"]
    if approve_with is not None:
        assert client.post(f"{API}/admin/volunteers/{vid}/approve", headers=approve_with).status_code == 200
    return headers, vid


def register_donor(client, n=1, **over):
    body = {"name": f"Donor {n}", "email": f"donor{n}@example.com", "password": "Passw0rdX", "phone_number": f"+91800000{n:04d}"}
    body.update(over)
    r = client.post(f"{API}/auth/register/donor", json=body)
    assert r.status_code == 201, r.text
    data = r.json()
    return auth_header(data["access_token"]), data["user"]["donor_id"]


def make_campaign(client, admin, *, publish=True, goal="10000.00", **over):
    today = local_today()
    body = {
        "title": "School Supplies Drive",
        "description": "Notebooks and bags for 200 children.",
        "category": "education",
        "goal_amount": goal,
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=30)).isoformat(),
    }
    body.update(over)
    r = client.post(f"{API}/admin/campaigns", json=body, headers=admin)
    assert r.status_code == 201, r.text
    cid = r.json()["campaign_id"]
    if publish:
        r = client.post(f"{API}/admin/campaigns/{cid}/publish", headers=admin)
        assert r.status_code == 200, r.text
    return cid


def guest_donate(client, campaign_id, amount="500.00", *, outcome="success", method="upi", name="Guest Giver", email="guest@example.com"):
    """Runs initiate + confirm. Returns (confirmed_donation_json, token)."""
    r = client.post(
        f"{API}/donations",
        json={
            "campaign_id": campaign_id,
            "amount": amount,
            "payment_method": method,
            "donor": {"name": name, "email": email},
        },
    )
    assert r.status_code == 201, r.text
    init = r.json()
    token = init["access_token"]
    r = client.post(
        f"{API}/donations/{init['donation']['donation_id']}/confirm",
        json={"simulate_outcome": outcome},
        headers={"X-Donation-Token": token},
    )
    assert r.status_code == 200, r.text
    return r.json(), token


def make_event(client, admin, *, publish=True, slots=3, days=7, **over):
    body = {
        "title": "Food Distribution Camp",
        "description": "Distribute meal kits.",
        "event_date": (utcnow() + timedelta(days=days)).isoformat(),
        "location": "Community Hall, Mumbai",
        "volunteers_required": slots,
    }
    body.update(over)
    r = client.post(f"{API}/admin/events", json=body, headers=admin)
    assert r.status_code == 201, r.text
    eid = r.json()["event_id"]
    if publish:
        r = client.post(f"{API}/admin/events/{eid}/publish", headers=admin)
        assert r.status_code == 200, r.text
    return eid
