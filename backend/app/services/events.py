from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import AppError, bad_request, conflict, not_found
from app.models import (
    AttendanceStatus,
    Event,
    EventRegistration,
    EventStatus,
    User,
    Volunteer,
    VolunteerStatus,
)
from app.schemas.events import (
    BulkAttendanceRequest,
    EventCreate,
    EventOut,
    EventUpdate,
    RegistrationBrief,
    RegistrationUpdate,
)
from app.services.audit import log_action
from app.services.locks import critical_section


# --- Presentation helpers ----------------------------------------------------------------------
def registration_counts(db: Session, event_ids: list[int]) -> dict[int, int]:
    if not event_ids:
        return {}
    rows = db.execute(
        select(EventRegistration.event_id, func.count())
        .where(EventRegistration.event_id.in_(event_ids))
        .group_by(EventRegistration.event_id)
    ).all()
    return {event_id: count for event_id, count in rows}


def to_event_outs(db: Session, events: list[Event], volunteer: Volunteer | None = None) -> list[EventOut]:
    counts = registration_counts(db, [e.event_id for e in events])
    mine: dict[int, EventRegistration] = {}
    if volunteer is not None and events:
        regs = db.scalars(
            select(EventRegistration).where(
                EventRegistration.volunteer_id == volunteer.volunteer_id,
                EventRegistration.event_id.in_([e.event_id for e in events]),
            )
        ).all()
        mine = {r.event_id: r for r in regs}
    out = []
    for e in events:
        n = counts.get(e.event_id, 0)
        reg = mine.get(e.event_id)
        out.append(
            EventOut.model_validate(e).model_copy(
                update={
                    "registered_count": n,
                    "slots_remaining": max(e.volunteers_required - n, 0),
                    "is_full": n >= e.volunteers_required,
                    "my_registration": RegistrationBrief.model_validate(reg) if reg else None,
                }
            )
        )
    return out


# --- Lookups --------------------------------------------------------------------------------
def get_event(db: Session, event_id: int, *, lock: bool = False) -> Event:
    stmt = select(Event).where(Event.event_id == event_id)
    if lock:
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    event = db.scalar(stmt)
    if event is None:
        raise not_found("Event")
    return event


def sync_event_statuses(db: Session) -> int:
    """Published events whose date has passed become 'completed' (run by the background job)."""
    due = db.scalars(select(Event).where(Event.status == EventStatus.PUBLISHED, Event.event_date <= utcnow())).all()
    for e in due:
        e.status = EventStatus.COMPLETED
    if due:
        db.commit()
    return len(due)


def _require_future(value, field: str) -> None:
    if value <= utcnow():
        raise bad_request("EVENT_DATE_IN_PAST", "The event date must be in the future", field)


# --- Admin: lifecycle ----------------------------------------------------------------------------
def create_event(db: Session, admin: User, data: EventCreate) -> Event:
    _require_future(data.event_date, "event_date")
    event = Event(
        title=data.title,
        description=data.description,
        event_date=data.event_date,
        location=data.location,
        volunteers_required=data.volunteers_required,
        status=EventStatus.DRAFT,
        created_by=admin.id,
    )
    db.add(event)
    db.flush()
    log_action(db, admin, "event.create", "event", event.event_id, {"title": event.title})
    db.commit()
    return event


def update_event(db: Session, admin: User, event_id: int, data: EventUpdate) -> Event:
    event = get_event(db, event_id)
    if event.status in (EventStatus.CANCELLED, EventStatus.COMPLETED):
        raise conflict("INVALID_STATE", f"A {event.status.value} event cannot be edited")
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if "event_date" in changes:
        _require_future(changes["event_date"], "event_date")
    if "volunteers_required" in changes:
        registered = registration_counts(db, [event_id]).get(event_id, 0)
        if changes["volunteers_required"] < registered:
            raise bad_request(
                "SLOTS_BELOW_REGISTERED",
                f"{registered} volunteers have already signed up; the required count cannot be lower",
                "volunteers_required",
            )
    for name, value in changes.items():
        setattr(event, name, value)
    log_action(db, admin, "event.update", "event", event.event_id, {"fields": sorted(changes)})
    db.commit()
    return event


def publish_event(db: Session, admin: User, event_id: int) -> Event:
    event = get_event(db, event_id)
    if event.status != EventStatus.DRAFT:
        raise conflict("INVALID_STATE", f"Only a draft event can be published (current: {event.status.value})")
    _require_future(event.event_date, "event_date")
    event.status = EventStatus.PUBLISHED
    log_action(db, admin, "event.publish", "event", event.event_id)
    db.commit()
    return event


def cancel_event(db: Session, admin: User, event_id: int) -> tuple[Event, int]:
    """Returns (event, number of volunteers to notify)."""
    event = get_event(db, event_id)
    if event.status not in (EventStatus.DRAFT, EventStatus.PUBLISHED):
        raise conflict("INVALID_STATE", f"A {event.status.value} event cannot be cancelled")
    event.status = EventStatus.CANCELLED
    notified = registration_counts(db, [event_id]).get(event_id, 0)
    log_action(db, admin, "event.cancel", "event", event.event_id, {"volunteers_notified": notified})
    db.commit()
    return event, notified


# --- Volunteer: sign-up / withdraw ----------------------------------------------------------------------------
def signup(db: Session, event_id: int, volunteer: Volunteer) -> EventRegistration:
    if volunteer.status != VolunteerStatus.APPROVED:  # BR-6
        raise AppError(
            403,
            "VOLUNTEER_NOT_APPROVED",
            "Your volunteer account must be approved by an admin before you can sign up for events"
            if volunteer.status == VolunteerStatus.PENDING
            else "Your volunteer account is deactivated; you cannot sign up for new events",
        )
    with critical_section:
        event = get_event(db, event_id, lock=True)
        if event.status != EventStatus.PUBLISHED:
            raise conflict("EVENT_NOT_OPEN", "This event is not open for sign-up")
        if event.event_date <= utcnow():
            raise conflict("EVENT_PASSED", "This event has already started or finished")

        already = db.scalar(
            select(EventRegistration.registration_id).where(
                EventRegistration.event_id == event_id, EventRegistration.volunteer_id == volunteer.volunteer_id
            )
        )
        if already:
            raise conflict("ALREADY_REGISTERED", "You are already signed up for this event")

        taken = registration_counts(db, [event_id]).get(event_id, 0)
        if taken >= event.volunteers_required:  # Event.Signup.Full
            raise conflict("EVENT_FULL", "This event is fully subscribed")

        reg = EventRegistration(event_id=event_id, volunteer_id=volunteer.volunteer_id)
        db.add(reg)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise conflict("ALREADY_REGISTERED", "You are already signed up for this event")
        return reg


def withdraw(db: Session, event_id: int, volunteer: Volunteer) -> None:
    with critical_section:
        reg = db.scalar(
            select(EventRegistration).where(
                EventRegistration.event_id == event_id, EventRegistration.volunteer_id == volunteer.volunteer_id
            )
        )
        if reg is None:
            raise not_found("Sign-up")
        if reg.event.event_date <= utcnow():
            raise conflict("EVENT_PASSED", "You cannot withdraw from an event that has already started")
        db.delete(reg)
        db.commit()


# --- Admin: roster, tasks, attendance ----------------------------------------------------------------------------
def roster(db: Session, event_id: int) -> list[EventRegistration]:
    get_event(db, event_id)
    return list(
        db.scalars(
            select(EventRegistration)
            .where(EventRegistration.event_id == event_id)
            .order_by(EventRegistration.registered_at, EventRegistration.registration_id)
        ).all()
    )


def _get_registration(db: Session, event_id: int, registration_id: int) -> EventRegistration:
    reg = db.get(EventRegistration, registration_id)
    if reg is None or reg.event_id != event_id:
        raise not_found("Sign-up")
    return reg


def _require_attendance_allowed(event: Event) -> None:
    if event.status not in (EventStatus.PUBLISHED, EventStatus.COMPLETED) or event.event_date > utcnow():
        raise conflict("ATTENDANCE_NOT_ALLOWED", "Attendance can only be recorded after the event date has passed")


def update_registration(
    db: Session, admin: User, event_id: int, registration_id: int, data: RegistrationUpdate
) -> EventRegistration:
    event = get_event(db, event_id)
    reg = _get_registration(db, event_id, registration_id)
    if event.status == EventStatus.CANCELLED:
        raise conflict("INVALID_STATE", "This event was cancelled")
    if "task" in data.model_fields_set:  # Event.Task.Assign
        reg.task = (data.task or "").strip() or None
        log_action(db, admin, "event.task_assign", "event_registration", reg.registration_id, {"task": reg.task})
    if data.attendance_status is not None:  # Event.Attendance.Mark
        _require_attendance_allowed(event)
        reg.attendance_status = data.attendance_status
        log_action(
            db, admin, "event.attendance", "event_registration", reg.registration_id,
            {"status": data.attendance_status.value},
        )
    db.commit()
    return reg


def mark_attendance_bulk(db: Session, admin: User, event_id: int, data: BulkAttendanceRequest) -> list[EventRegistration]:
    event = get_event(db, event_id)
    _require_attendance_allowed(event)
    updated = []
    for rec in data.records:
        reg = _get_registration(db, event_id, rec.registration_id)
        reg.attendance_status = rec.attendance_status
        updated.append(reg)
    log_action(db, admin, "event.attendance_bulk", "event", event_id, {"count": len(updated)})
    if event.status == EventStatus.PUBLISHED:
        event.status = EventStatus.COMPLETED
    db.commit()
    return updated


# --- Volunteer views ----------------------------------------------------------------------------
def volunteer_registrations(db: Session, volunteer_id: int, *, current_only: bool) -> list[EventRegistration]:
    """current_only=True -> Volunteer.Task.View (upcoming, not cancelled);
    False -> Event.History.View (everything, newest first)."""
    stmt = select(EventRegistration).join(Event).where(EventRegistration.volunteer_id == volunteer_id)
    if current_only:
        stmt = stmt.where(Event.status == EventStatus.PUBLISHED, Event.event_date > utcnow()).order_by(Event.event_date)
    else:
        stmt = stmt.order_by(Event.event_date.desc())
    return list(db.scalars(stmt).unique().all())


def attended_count(db: Session, volunteer_id: int) -> int:
    return (
        db.scalar(
            select(func.count()).where(
                EventRegistration.volunteer_id == volunteer_id,
                EventRegistration.attendance_status == AttendanceStatus.ATTENDED,
            )
        )
        or 0
    )
