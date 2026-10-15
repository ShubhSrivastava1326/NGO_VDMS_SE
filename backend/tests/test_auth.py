from sqlalchemy import select

from app.models import User
from tests.conftest import API, auth_header, login, register_donor, register_volunteer


def test_volunteer_registration_creates_pending_account(client):
    r = client.post(
        f"{API}/auth/register/volunteer",
        json={
            "name": "Asha Rao",
            "email": "Asha@Example.com",
            "password": "Passw0rdX",
            "phone_number": "+91 98765-43210",
            "areas_of_interest": ["teaching"],
            "availability": "Weekends",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    user = body["user"]
    assert user["role"] == "volunteer"
    assert user["email"] == "asha@example.com"  # normalised
    assert user["volunteer_status"] == "pending"  # Volunteer.Approve: needs admin approval

    me = client.get(f"{API}/volunteers/me", headers=auth_header(body["access_token"])).json()
    assert me["phone_number"] == "+919876543210"  # normalised
    assert me["status"] == "pending"


def test_volunteer_register_rejects_duplicate_email_and_phone(client):
    register_volunteer(client, 1)
    r = client.post(
        f"{API}/auth/register/volunteer",
        json={"name": "X", "email": "VOL1@example.com", "password": "Passw0rdX", "phone_number": "+919999999999", "areas_of_interest": ["a"]},
    )
    assert r.status_code == 409 and r.json()["code"] == "EMAIL_ALREADY_REGISTERED"
    r = client.post(
        f"{API}/auth/register/volunteer",
        json={"name": "X", "email": "new@example.com", "password": "Passw0rdX", "phone_number": "+91 90000-00001", "areas_of_interest": ["a"]},
    )
    assert r.status_code == 409 and r.json()["code"] == "PHONE_ALREADY_REGISTERED"


def test_validation_errors_use_the_common_envelope(client):
    r = client.post(
        f"{API}/auth/register/volunteer",
        json={"name": "", "email": "not-an-email", "password": "short", "phone_number": "abc", "areas_of_interest": []},
    )
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "VALIDATION_ERROR"
    fields = {e["field"] for e in body["errors"]}
    assert {"name", "email", "password", "phone_number", "areas_of_interest"} <= fields


def test_password_is_stored_as_salted_hash(client, db):
    register_donor(client, 1)
    user = db.scalar(select(User).where(User.email == "donor1@example.com"))
    assert user.password_hash != "Passw0rdX"
    assert user.password_hash.startswith("$2")  # bcrypt, salted


def test_login_success_and_failure(client):
    register_donor(client, 1)
    ok = client.post(f"{API}/auth/login", json={"email": "donor1@example.com", "password": "Passw0rdX"})
    assert ok.status_code == 200 and ok.json()["user"]["role"] == "donor"

    for body in (
        {"email": "donor1@example.com", "password": "wrong-password"},
        {"email": "nobody@example.com", "password": "Passw0rdX"},
    ):
        bad = client.post(f"{API}/auth/login", json=body)
        assert bad.status_code == 401 and bad.json()["code"] == "INVALID_CREDENTIALS"


def test_swagger_form_login_works(client):
    r = client.post(f"{API}/auth/token", data={"username": "admin@ngo.org", "password": "Admin@12345"})
    assert r.status_code == 200 and r.json()["access_token"]


def test_me_endpoint_and_missing_or_bad_token(client):
    h, donor_id = register_donor(client, 1)
    me = client.get(f"{API}/auth/me", headers=h).json()
    assert me["role"] == "donor" and me["donor_id"] == donor_id

    r = client.get(f"{API}/auth/me")
    assert r.status_code == 401 and r.json()["code"] == "NOT_AUTHENTICATED"
    r = client.get(f"{API}/auth/me", headers=auth_header("garbage"))
    assert r.status_code == 401 and r.json()["code"] == "INVALID_TOKEN"


def test_role_based_access_control(client, admin):
    vol, _ = register_volunteer(client, 1)
    donor, _ = register_donor(client, 1)

    # Volunteer / donor cannot reach admin functions (SE-4)
    for h in (vol, donor):
        assert client.get(f"{API}/admin/campaigns", headers=h).status_code == 403
        assert client.post(f"{API}/admin/campaigns", json={}, headers=h).status_code == 403
    assert client.get(f"{API}/admin/campaigns").status_code == 401
    # Donor cannot use volunteer functions and vice-versa
    assert client.get(f"{API}/volunteers/me", headers=donor).status_code == 403
    assert client.get(f"{API}/donors/me", headers=vol).status_code == 403
    assert client.get(f"{API}/admin/campaigns", headers=admin).status_code == 200


def test_change_password(client):
    h, _ = register_donor(client, 1)
    r = client.post(f"{API}/auth/change-password", json={"current_password": "nope12345", "new_password": "NewPassw0rd"}, headers=h)
    assert r.status_code == 400 and r.json()["code"] == "WRONG_PASSWORD"
    r = client.post(f"{API}/auth/change-password", json={"current_password": "Passw0rdX", "new_password": "NewPassw0rd"}, headers=h)
    assert r.status_code == 200
    login(client, "donor1@example.com", "NewPassw0rd")


def test_admin_can_create_another_admin(client, admin):
    r = client.post(f"{API}/admin/admins", json={"name": "Second Admin", "email": "admin2@ngo.org", "password": "Passw0rdX"}, headers=admin)
    assert r.status_code == 201 and r.json()["role"] == "admin"
    login(client, "admin2@ngo.org", "Passw0rdX")
