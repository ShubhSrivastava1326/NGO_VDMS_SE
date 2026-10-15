"""Events as seen by volunteers: browse (public), sign up, withdraw."""
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.deps import DB, CurrentVolunteer, OptionalUser, Page, Pagination, make_page
from app.core.errors import not_found
from app.models import Event, EventStatus, Role, Volunteer
from app.schemas.common import Message
from app.schemas.events import EventOut, RegistrationOut
from app.services import events as svc
from app.services.notifications import send_event_signup_confirmation

router = APIRouter(prefix="/events", tags=["Events (volunteers)"])


def _volunteer_of(db: Session, user) -> Volunteer | None:
    if user is not None and user.role == Role.VOLUNTEER:
        return db.scalar(select(Volunteer).where(Volunteer.user_id == user.id))
    return None


@router.get(
    "",
    response_model=Page[EventOut],
    summary="List published events (public). If a volunteer token is sent, my_registration is filled in",
)
def list_events(
    db: DB,
    params: Pagination,
    user: OptionalUser,
    include_past: Annotated[bool, Query(description="Also include events that already happened")] = False,
    q: Annotated[str | None, Query(description="Search in title/location")] = None,
):
    svc.sync_event_statuses(db)
    statuses = [EventStatus.PUBLISHED] + ([EventStatus.COMPLETED] if include_past else [])
    stmt = select(Event).where(Event.status.in_(statuses))
    if not include_past:
        stmt = stmt.where(Event.event_date > utcnow())
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Event.title).like(like), func.lower(Event.location).like(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = Event.event_date.desc() if include_past else Event.event_date.asc()
    rows = list(db.scalars(stmt.order_by(order).offset(params.offset).limit(params.page_size)).all())
    return make_page(svc.to_event_outs(db, rows, _volunteer_of(db, user)), total, params)


@router.get("/{event_id}", response_model=EventOut, summary="Event detail (drafts are admin-only)")
def get_event(event_id: int, db: DB, user: OptionalUser):
    event = svc.get_event(db, event_id)
    if event.status == EventStatus.DRAFT and not (user and user.role == Role.ADMIN):
        raise not_found("Event")
    return svc.to_event_outs(db, [event], _volunteer_of(db, user))[0]


@router.post(
    "/{event_id}/signup",
    response_model=RegistrationOut,
    status_code=201,
    summary="Sign up for an event (approved volunteers only; fails with EVENT_FULL when no slots remain)",
)
def signup(event_id: int, volunteer: CurrentVolunteer, db: DB, background: BackgroundTasks):
    reg = svc.signup(db, event_id, volunteer)
    background.add_task(send_event_signup_confirmation, reg.registration_id)  # CI-2
    return reg


@router.delete("/{event_id}/signup", response_model=Message, summary="Withdraw from an event (before it starts)")
def withdraw(event_id: int, volunteer: CurrentVolunteer, db: DB):
    svc.withdraw(db, event_id, volunteer)
    return Message(detail="You have been removed from this event")
