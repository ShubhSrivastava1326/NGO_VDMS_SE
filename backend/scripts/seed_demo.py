"""Fill an empty database with realistic demo data so the frontend has something to render.

    python -m scripts.seed_demo          (run from the backend/ folder)

Safe to re-run: it does nothing if campaigns already exist.
Demo logins (password for all demo accounts: Demo@1234; admin comes from .env):
    admin      admin@ngo.org      (ADMIN_PASSWORD, default Admin@12345)
    volunteer  volunteer@demo.org (approved)      pending@demo.org (waiting for approval)
    donor      donor@demo.org
"""
from datetime import timedelta

from sqlalchemy import func, select

from app.core.clock import local_today, utcnow
from app.db.session import SessionLocal, init_db
from app.models import Campaign, Role, User, Volunteer
from app.schemas.auth import DonorRegister, VolunteerRegister
from app.schemas.campaigns import CampaignCreate
from app.schemas.donations import DonationCreate, GuestDonorDetails
from app.schemas.events import EventCreate
from app.schemas.funds import UtilizationCreate
from app.services import auth, campaigns, donations, events, funds, volunteers

PASSWORD = "Demo@1234"


def main() -> None:
    init_db()
    with SessionLocal() as db:
        auth.ensure_initial_admin(db)
        if db.scalar(select(func.count()).select_from(Campaign)):
            print("Database already has campaigns - nothing to do.")
            return
        admin = db.scalar(select(User).where(User.role == Role.ADMIN))
        today = local_today()

        # --- people ---------------------------------------------------------------------------------
        vol_user = auth.register_volunteer(
            db,
            VolunteerRegister(
                name="Meera Joshi", email="volunteer@demo.org", password=PASSWORD, phone_number="+919820011111",
                areas_of_interest=["logistics", "teaching"], availability="Weekends",
            ),
        )
        auth.register_volunteer(
            db,
            VolunteerRegister(
                name="Karan Mehta", email="pending@demo.org", password=PASSWORD, phone_number="+919820022222",
                areas_of_interest=["fundraising"],
            ),
        )
        auth.register_donor(
            db, DonorRegister(name="Anita Desai", email="donor@demo.org", password=PASSWORD, phone_number="+919820033333")
        )
        vol = db.scalar(select(Volunteer).where(Volunteer.user_id == vol_user.id))
        volunteers.approve(db, admin, vol.volunteer_id)

        # --- campaigns ---------------------------------------------------------------------------------
        def campaign(title, category, goal, desc, days=30, publish=True):
            c = campaigns.create_campaign(
                db, admin,
                CampaignCreate(
                    title=title, category=category, goal_amount=goal, description=desc,
                    start_date=today - timedelta(days=5), end_date=today + timedelta(days=days),
                ),
            )
            return campaigns.publish_campaign(db, admin, c.campaign_id) if publish else c

        books = campaign("School Supplies Drive", "education", "50000.00", "Notebooks, bags and stationery for 200 children.")
        clinic = campaign("Mobile Health Clinic", "healthcare", "120000.00", "A van with a doctor visiting 10 villages.", days=14)
        flood = campaign("Flood Relief Fund", "disaster relief", "20000.00", "Emergency food and blankets.", days=60)
        campaign("Winter Blankets (draft)", "food & nutrition", "30000.00", "Not yet published.", publish=False)

        # --- donations (simulated payments) ----------------------------------------------------------
        def donate(cid, amount, name, email, method="upi", outcome="success"):
            d = donations.initiate_donation(
                db,
                DonationCreate(
                    campaign_id=cid, amount=amount, payment_method=method,
                    donor=GuestDonorDetails(name=name, email=email),
                ),
                None,
            )
            return donations.confirm_donation(db, d, outcome)

        for amount, name, email in [
            ("5000.00", "Ravi Kulkarni", "ravi@example.com"),
            ("2500.00", "Sunita Patil", "sunita@example.com"),
            ("1000.00", "Ravi Kulkarni", "ravi@example.com"),
            ("7500.50", "Tech Mahindra Foundation", "csr@example.com"),
        ]:
            donate(books.campaign_id, amount, name, email)
        donate(clinic.campaign_id, "15000.00", "Sunita Patil", "sunita@example.com", "card")
        donate(clinic.campaign_id, "999.00", "Failed Example", "fail@example.com", outcome="failure")
        donate(flood.campaign_id, "20000.00", "Big Donor", "big@example.com", "net_banking")  # reaches goal -> auto-closes

        funds.record_utilization(
            db, admin, books.campaign_id,
            UtilizationCreate(category="supplies", amount="8000.00", description="Notebooks (500 units)", reference_number="INV-2026-001"),
        )
        funds.record_utilization(
            db, admin, books.campaign_id,
            UtilizationCreate(category="logistics", amount="1500.00", description="Transport to school", reference_number="VCH-2026-014"),
        )
        funds.record_utilization(
            db, admin, flood.campaign_id,
            UtilizationCreate(category="beneficiary disbursement", amount="12000.00", description="Food kits for 120 families", reference_number="VCH-2026-020"),
        )

        # --- events ----------------------------------------------------------------------------------------
        def event(title, days, slots, location, publish=True):
            e = events.create_event(
                db, admin,
                EventCreate(
                    title=title, description=f"{title}. Volunteers needed for registration, logistics and crowd management.",
                    event_date=utcnow() + timedelta(days=days), location=location, volunteers_required=slots,
                ),
            )
            return events.publish_event(db, admin, e.event_id) if publish else e

        camp = event("Food Distribution Camp", 6, 5, "Community Hall, Andheri, Mumbai")
        event("Book Donation Drive", 12, 2, "St. Mary School, Pune")
        event("Health Check-up Camp", 20, 8, "Gram Panchayat Office, Raigad")
        event("Annual Fundraiser Gala (draft)", 45, 15, "Hotel Grand, Mumbai", publish=False)

        reg = events.signup(db, camp.event_id, vol)
        reg.task = "registration desk"
        db.commit()

        print("Seeded demo data.\n  admin:     admin@ngo.org / (ADMIN_PASSWORD)\n"
              f"  volunteer: volunteer@demo.org / {PASSWORD}  (approved)\n"
              f"  pending:   pending@demo.org   / {PASSWORD}  (awaiting approval)\n"
              f"  donor:     donor@demo.org     / {PASSWORD}")


if __name__ == "__main__":
    main()
