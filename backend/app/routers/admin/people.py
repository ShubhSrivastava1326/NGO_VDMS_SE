"""Admin: volunteers (3.1), donors (3.4), donations list, audit & e-mail logs, extra admins."""
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.core.deps import DB, AdminUser, Page, Pagination, make_page
from app.models import AuditLog, Donation, DonationStatus, EmailLog, Volunteer, VolunteerStatus
from app.schemas.admin import AdminCreate, AuditLogOut, EmailLogOut
from app.schemas.auth import UserOut
from app.schemas.donations import DonationOut
from app.schemas.donors import DonorDetail, DonorSummary, DuplicateGroup, MergeDonorsRequest
from app.schemas.events import RegistrationOut
from app.schemas.volunteers import VolunteerAdminDetail, VolunteerOut
from app.services import auth as auth_svc
from app.services import donors as donor_svc
from app.services import events as event_svc
from app.services import volunteers as vol_svc

router = APIRouter(tags=["Admin: people & logs"])


# --- Volunteers ------------------------------------------------------------------------------
@router.get("/volunteers", response_model=Page[VolunteerOut], summary="List/search volunteers")
def list_volunteers(
    db: DB,
    params: Pagination,
    status: Annotated[VolunteerStatus | None, Query(description="pending | approved | deactivated")] = None,
    q: Annotated[str | None, Query(description="Search name, e-mail or phone")] = None,
):
    rows, total = vol_svc.search_volunteers(db, status, q, params.offset, params.page_size)
    return make_page([VolunteerOut.model_validate(v) for v in rows], total, params)


@router.get(
    "/volunteers/{volunteer_id}",
    response_model=VolunteerAdminDetail,
    summary="Volunteer.Profile.View: profile + assignment history",
)
def get_volunteer(volunteer_id: int, db: DB):
    vol = vol_svc.get_volunteer(db, volunteer_id)
    history = event_svc.volunteer_registrations(db, volunteer_id, current_only=False)
    return VolunteerAdminDetail(
        **VolunteerOut.model_validate(vol).model_dump(),
        assignment_history=[RegistrationOut.model_validate(r) for r in history],
    )


@router.post("/volunteers/{volunteer_id}/approve", response_model=VolunteerOut, summary="Approve (or re-activate)")
def approve_volunteer(volunteer_id: int, admin: AdminUser, db: DB):
    return vol_svc.approve(db, admin, volunteer_id)


@router.post("/volunteers/{volunteer_id}/deactivate", response_model=VolunteerOut, summary="Deactivate (or reject)")
def deactivate_volunteer(volunteer_id: int, admin: AdminUser, db: DB):
    return vol_svc.deactivate(db, admin, volunteer_id)


# --- Donors ------------------------------------------------------------------------------------
@router.get("/donors", response_model=Page[DonorSummary], summary="Donor.Record.Search (name, e-mail or phone)")
def list_donors(db: DB, params: Pagination, q: Annotated[str | None, Query()] = None):
    items, total = donor_svc.search_donors(db, q, params.offset, params.page_size)
    return make_page(items, total, params)


# NOTE: declared before /donors/{donor_id} so "duplicates" is not parsed as an id.
@router.get("/donors/duplicates", response_model=list[DuplicateGroup], summary="Donor.Merge.Flag: same e-mail, several records")
def donor_duplicates(db: DB):
    return donor_svc.find_duplicates(db)


@router.post("/donors/merge", response_model=DonorSummary, summary="Merge duplicate donor records into one")
def merge_donors(data: MergeDonorsRequest, admin: AdminUser, db: DB):
    primary = donor_svc.merge_donors(db, admin, data)
    return donor_svc.donor_summary(db, primary)


@router.get("/donors/{donor_id}", response_model=DonorDetail, summary="Donor.Record.View")
def get_donor(donor_id: int, db: DB):
    return donor_svc.donor_detail(db, donor_svc.get_donor(db, donor_id))


# --- Donations (read-only overview) ------------------------------------------------------------------
@router.get("/donations", response_model=Page[DonationOut], summary="All donations with filters")
def list_donations(
    db: DB,
    params: Pagination,
    campaign_id: Annotated[int | None, Query()] = None,
    donor_id: Annotated[int | None, Query()] = None,
    status: Annotated[DonationStatus | None, Query()] = None,
):
    stmt = select(Donation)
    if campaign_id:
        stmt = stmt.where(Donation.campaign_id == campaign_id)
    if donor_id:
        stmt = stmt.where(Donation.donor_id == donor_id)
    if status:
        stmt = stmt.where(Donation.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Donation.donation_date.desc(), Donation.donation_id.desc()).offset(params.offset).limit(params.page_size)
    ).all()
    return make_page([DonationOut.model_validate(d) for d in rows], total, params)


# --- Logs & staff accounts -------------------------------------------------------------------------------
@router.get("/audit-log", response_model=Page[AuditLogOut], summary="Audit trail (SE-6)")
def audit_log(
    db: DB,
    params: Pagination,
    entity_type: Annotated[str | None, Query(description="e.g. fund_utilization, campaign, volunteer")] = None,
    action: Annotated[str | None, Query()] = None,
):
    stmt = select(AuditLog)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(AuditLog.id.desc()).offset(params.offset).limit(params.page_size)).all()
    return make_page([AuditLogOut.model_validate(r) for r in rows], total, params)


@router.get("/email-log", response_model=Page[EmailLogOut], summary="Every e-mail the system sent/skipped/failed")
def email_log(db: DB, params: Pagination):
    total = db.scalar(select(func.count()).select_from(EmailLog)) or 0
    rows = db.scalars(select(EmailLog).order_by(EmailLog.id.desc()).offset(params.offset).limit(params.page_size)).all()
    return make_page([EmailLogOut.model_validate(r) for r in rows], total, params)


@router.post("/admins", response_model=UserOut, status_code=201, summary="Create another admin (staff) account")
def create_admin(data: AdminCreate, db: DB, _: AdminUser):
    user = auth_svc.create_admin(db, data.name, data.email, data.password)
    return auth_svc.user_out(db, user)
