"""The logged-in volunteer's own profile, assignments and dashboard."""
from fastapi import APIRouter
from sqlalchemy import select

from app.core.clock import utcnow
from app.core.deps import DB, CurrentVolunteer
from app.models import Event, EventStatus
from app.schemas.events import RegistrationOut
from app.schemas.volunteers import VolunteerDashboard, VolunteerOut, VolunteerUpdate
from app.services import events as event_svc
from app.services import volunteers as svc

router = APIRouter(prefix="/volunteers/me", tags=["Volunteer (self)"])


@router.get("", response_model=VolunteerOut, summary="My volunteer profile (includes approval status)")
def my_profile(volunteer: CurrentVolunteer):
    return volunteer


@router.patch("", response_model=VolunteerOut, summary="Update my profile (send only the fields to change)")
def update_my_profile(data: VolunteerUpdate, volunteer: CurrentVolunteer, db: DB):
    return svc.update_profile(db, volunteer, data)


@router.get("/tasks", response_model=list[RegistrationOut], summary="Volunteer.Task.View: my upcoming events/tasks")
def my_tasks(volunteer: CurrentVolunteer, db: DB):
    return event_svc.volunteer_registrations(db, volunteer.volunteer_id, current_only=True)


@router.get("/history", response_model=list[RegistrationOut], summary="Event.History.View: all my participation")
def my_history(volunteer: CurrentVolunteer, db: DB):
    return event_svc.volunteer_registrations(db, volunteer.volunteer_id, current_only=False)


@router.get("/dashboard", response_model=VolunteerDashboard, summary="Everything for the volunteer home screen")
def dashboard(volunteer: CurrentVolunteer, db: DB):
    event_svc.sync_event_statuses(db)
    open_events = list(
        db.scalars(
            select(Event)
            .where(Event.status == EventStatus.PUBLISHED, Event.event_date > utcnow())
            .order_by(Event.event_date)
            .limit(6)
        ).all()
    )
    return VolunteerDashboard(
        volunteer=VolunteerOut.model_validate(volunteer),
        upcoming_assignments=[
            RegistrationOut.model_validate(r)
            for r in event_svc.volunteer_registrations(db, volunteer.volunteer_id, current_only=True)
        ],
        events_attended=event_svc.attended_count(db, volunteer.volunteer_id),
        open_events=event_svc.to_event_outs(db, open_events, volunteer),
    )
