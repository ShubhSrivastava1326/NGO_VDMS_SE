from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import VolunteerStatus
from app.schemas.common import ORMModel, PersonName, Phone, ShortText
from app.schemas.events import EventOut, RegistrationOut


class VolunteerOut(ORMModel):
    volunteer_id: int
    name: str
    email: str
    phone_number: str
    areas_of_interest: list[str]
    availability: str | None = None
    status: VolunteerStatus
    created_at: datetime


class VolunteerUpdate(BaseModel):
    """Volunteer.Profile.Edit. (E-mail is the login identity and cannot be changed in Release 1.0.)"""

    name: PersonName | None = None
    phone_number: Phone | None = None
    areas_of_interest: list[ShortText] | None = Field(default=None, min_length=1, max_length=20)
    availability: str | None = Field(default=None, max_length=500)


class VolunteerAdminDetail(VolunteerOut):
    """Volunteer.Profile.View (admin): profile + full assignment history."""

    assignment_history: list[RegistrationOut]


class VolunteerDashboard(BaseModel):
    volunteer: VolunteerOut
    upcoming_assignments: list[RegistrationOut]
    events_attended: int
    open_events: list[EventOut]
