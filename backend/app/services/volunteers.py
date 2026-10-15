from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import AppError, conflict, not_found
from app.models import User, Volunteer, VolunteerStatus
from app.schemas.volunteers import VolunteerUpdate
from app.services.audit import log_action
from app.services.auth import phone_taken


def get_volunteer(db: Session, volunteer_id: int) -> Volunteer:
    vol = db.get(Volunteer, volunteer_id)
    if vol is None:
        raise not_found("Volunteer")
    return vol


def update_profile(db: Session, volunteer: Volunteer, data: VolunteerUpdate) -> Volunteer:  # Volunteer.Profile.Edit
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    new_phone = changes.get("phone_number")
    if new_phone and new_phone != volunteer.phone_number and phone_taken(db, new_phone):
        raise AppError(
            409, "PHONE_ALREADY_REGISTERED", "This phone number is used by another account",
            errors=[{"field": "phone_number", "message": "Already registered"}],
        )
    for name, value in changes.items():
        setattr(volunteer, name, value)
    if "name" in changes:
        volunteer.user.full_name = changes["name"]
    db.commit()
    return volunteer


def search_volunteers(db: Session, status: VolunteerStatus | None, q: str | None, offset: int, limit: int):
    stmt = select(Volunteer).join(User)
    if status:
        stmt = stmt.where(Volunteer.status == status)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(func.lower(Volunteer.name).like(like), func.lower(User.email).like(like), Volunteer.phone_number.like(like))
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Volunteer.created_at.desc(), Volunteer.volunteer_id.desc()).offset(offset).limit(limit)).unique().all()
    return list(rows), total


def approve(db: Session, admin: User, volunteer_id: int) -> Volunteer:  # Volunteer.Approve
    vol = get_volunteer(db, volunteer_id)
    if vol.status == VolunteerStatus.APPROVED:
        raise conflict("INVALID_STATE", "This volunteer is already approved")
    previous = vol.status
    vol.status = VolunteerStatus.APPROVED  # also re-activates a deactivated volunteer
    vol.status_changed_at = utcnow()
    log_action(db, admin, "volunteer.approve", "volunteer", vol.volunteer_id, {"from": previous.value})
    db.commit()
    return vol


def deactivate(db: Session, admin: User, volunteer_id: int) -> Volunteer:  # Volunteer.Deactivate
    vol = get_volunteer(db, volunteer_id)
    if vol.status == VolunteerStatus.DEACTIVATED:
        raise conflict("INVALID_STATE", "This volunteer is already deactivated")
    previous = vol.status
    vol.status = VolunteerStatus.DEACTIVATED
    vol.status_changed_at = utcnow()
    log_action(db, admin, "volunteer.deactivate", "volunteer", vol.volunteer_id, {"from": previous.value})
    db.commit()
    return vol
