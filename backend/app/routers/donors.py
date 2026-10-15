"""The logged-in donor's own profile and history (SE-5: only ever their own data)."""
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.deps import DB, CurrentDonor, Page, Pagination, make_page
from app.models import Campaign, CampaignStatus, Donation, DonationStatus
from app.schemas.campaigns import CampaignOut
from app.schemas.donations import DonationOut
from app.schemas.donors import DonorDashboard, DonorOut, DonorSummary, DonorUpdate
from app.services import donors as svc
from app.services.campaigns import sync_all_campaigns

router = APIRouter(prefix="/donors/me", tags=["Donor (self)"])


@router.get("", response_model=DonorSummary, summary="My donor profile with lifetime totals")
def my_profile(donor: CurrentDonor, db: DB):
    return svc.donor_summary(db, donor)


@router.patch("", response_model=DonorOut, summary="Donor.Profile.Edit (name, phone)")
def update_my_profile(data: DonorUpdate, donor: CurrentDonor, db: DB):
    return svc.update_profile(db, donor, data)


@router.get("/donations", response_model=Page[DonationOut], summary="Donation.History.View: my donations, newest first")
def my_donations(
    donor: CurrentDonor,
    db: DB,
    params: Pagination,
    status: Annotated[DonationStatus | None, Query(description="Filter, e.g. 'completed'")] = None,
):
    stmt = select(Donation).where(Donation.donor_id == donor.donor_id)
    if status:
        stmt = stmt.where(Donation.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Donation.donation_date.desc(), Donation.donation_id.desc()).offset(params.offset).limit(params.page_size)
    ).all()
    return make_page([DonationOut.model_validate(d) for d in rows], total, params)


@router.get("/dashboard", response_model=DonorDashboard, summary="Everything for the donor home screen")
def dashboard(donor: CurrentDonor, db: DB):
    sync_all_campaigns(db)
    recent = db.scalars(
        select(Donation).where(Donation.donor_id == donor.donor_id).order_by(Donation.donation_date.desc()).limit(5)
    ).all()
    featured = db.scalars(
        select(Campaign).where(Campaign.status == CampaignStatus.ACTIVE).order_by(Campaign.end_date).limit(4)
    ).all()
    return DonorDashboard(
        donor=svc.donor_summary(db, donor),
        recent_donations=[DonationOut.model_validate(d) for d in recent],
        featured_campaigns=[CampaignOut.model_validate(c) for c in featured],
    )
