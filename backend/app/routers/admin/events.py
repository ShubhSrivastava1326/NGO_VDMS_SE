"""Admin: events, rosters, task assignment, attendance (3.5)."""
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query
from sqlalchemy import func, or_, select

from app.core.deps import DB, AdminUser, Page, Pagination, make_page
from app.models import Event, EventStatus
from app.schemas.events import (
    BulkAttendanceRequest,
    EventCreate,
    EventOut,
    EventUpdate,
    RegistrationUpdate,
    RosterEntry,
)
from app.services import events as svc
from app.services.notifications import send_event_cancellation

router = APIRouter(tags=["Admin: events"])


def _one(db, event) -> EventOut:
    return svc.to_event_outs(db, [event])[0]


@router.get("/events", response_model=Page[EventOut], summary="All events, any status")
def list_events(
    db: DB,
    params: Pagination,
    status: Annotated[EventStatus | None, Query()] = None,
    q: Annotated[str | None, Query()] = None,
):
    svc.sync_event_statuses(db)
    stmt = select(Event)
    if status:
        stmt = stmt.where(Event.status == status)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Event.title).like(like), func.lower(Event.location).like(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(db.scalars(stmt.order_by(Event.event_date.desc()).offset(params.offset).limit(params.page_size)).all())
    return make_page(svc.to_event_outs(db, rows), total, params)


@router.post("/events", response_model=EventOut, status_code=201, summary="Create an event (status 'draft')")
def create_event(data: EventCreate, admin: AdminUser, db: DB):
    return _one(db, svc.create_event(db, admin, data))


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int, db: DB):
    return _one(db, svc.get_event(db, event_id))


@router.patch("/events/{event_id}", response_model=EventOut, summary="Edit a draft/published event")
def update_event(event_id: int, data: EventUpdate, admin: AdminUser, db: DB):
    return _one(db, svc.update_event(db, admin, event_id, data))


@router.post("/events/{event_id}/publish", response_model=EventOut, summary="Draft -> Published (open for sign-up)")
def publish_event(event_id: int, admin: AdminUser, db: DB):
    return _one(db, svc.publish_event(db, admin, event_id))


@router.post(
    "/events/{event_id}/cancel",
    response_model=EventOut,
    summary="Cancel an event; every signed-up volunteer is e-mailed",
)
def cancel_event(event_id: int, admin: AdminUser, db: DB, background: BackgroundTasks):
    event, notified = svc.cancel_event(db, admin, event_id)
    if notified:
        background.add_task(send_event_cancellation, event.event_id)
    return _one(db, event)


@router.get("/events/{event_id}/registrations", response_model=list[RosterEntry], summary="Roster for an event")
def roster(event_id: int, db: DB):
    return svc.roster(db, event_id)


@router.patch(
    "/events/{event_id}/registrations/{registration_id}",
    response_model=RosterEntry,
    summary="Assign a task and/or set attendance for one volunteer",
)
def update_registration(event_id: int, registration_id: int, data: RegistrationUpdate, admin: AdminUser, db: DB):
    return svc.update_registration(db, admin, event_id, registration_id, data)


@router.post(
    "/events/{event_id}/attendance",
    response_model=list[RosterEntry],
    summary="Mark attendance for many volunteers at once (only after the event date)",
)
def mark_attendance(event_id: int, data: BulkAttendanceRequest, admin: AdminUser, db: DB):
    return svc.mark_attendance_bulk(db, admin, event_id, data)

