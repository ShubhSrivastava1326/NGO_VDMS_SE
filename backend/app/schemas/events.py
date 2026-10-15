from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import AttendanceStatus, EventStatus
from app.schemas.common import AwareDatetime, LongText, ORMModel


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    description: LongText
    event_date: AwareDatetime = Field(description="ISO 8601. Naive values are read as Asia/Kolkata time.")
    location: str = Field(min_length=1, max_length=255)
    volunteers_required: int = Field(ge=1, le=10000)


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    description: LongText | None = None
    event_date: AwareDatetime | None = None
    location: str | None = Field(default=None, min_length=1, max_length=255)
    volunteers_required: int | None = Field(default=None, ge=1, le=10000)


class EventBrief(ORMModel):
    event_id: int
    title: str
    event_date: datetime
    location: str
    status: EventStatus


class RegistrationOut(ORMModel):
    """A volunteer's sign-up for an event (with the event embedded)."""

    registration_id: int
    event: EventBrief
    task: str | None = None
    attendance_status: AttendanceStatus
    registered_at: datetime


class RegistrationBrief(ORMModel):
    registration_id: int
    task: str | None = None
    attendance_status: AttendanceStatus


class EventOut(ORMModel):
    event_id: int
    title: str
    description: str
    event_date: datetime
    location: str
    volunteers_required: int
    status: EventStatus
    registered_count: int = 0
    slots_remaining: int = 0
    is_full: bool = False
    # Present only when the caller is a logged-in volunteer who signed up for this event.
    my_registration: RegistrationBrief | None = None


class VolunteerBrief(ORMModel):
    volunteer_id: int
    name: str
    email: str
    phone_number: str


class RosterEntry(ORMModel):
    """Admin view of one sign-up on an event."""

    registration_id: int
    volunteer: VolunteerBrief
    task: str | None = None
    attendance_status: AttendanceStatus
    registered_at: datetime


class RegistrationUpdate(BaseModel):
    task: str | None = Field(default=None, max_length=120, description="Send null/\"\" to clear")
    attendance_status: AttendanceStatus | None = None

    @model_validator(mode="after")
    def _at_least_one(self):
        if not self.model_fields_set:
            raise ValueError("Provide task and/or attendance_status")
        return self


class AttendanceRecord(BaseModel):
    registration_id: int
    attendance_status: AttendanceStatus


class BulkAttendanceRequest(BaseModel):
    records: list[AttendanceRecord] = Field(min_length=1)
