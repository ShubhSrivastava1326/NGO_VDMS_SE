from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.db.session import Base
from app.db.types import Money, UTCDateTime
from app.models.campaign import Campaign
from app.models.enums import AttendanceStatus, EventStatus, enum_col
from app.models.user import User, Volunteer


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (CheckConstraint("volunteers_required > 0", name="ck_event_slots_positive"),)

    event_id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    event_date: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    location: Mapped[str] = mapped_column(String(255))
    volunteers_required: Mapped[int]
    status: Mapped[EventStatus] = mapped_column(
        enum_col(EventStatus), default=EventStatus.DRAFT, index=True
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class EventRegistration(Base):
    __tablename__ = "event_registrations"
    __table_args__ = (UniqueConstraint("event_id", "volunteer_id", name="uq_event_volunteer"),)

    registration_id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.event_id"), index=True)
    volunteer_id: Mapped[int] = mapped_column(ForeignKey("volunteers.volunteer_id"), index=True)
    task: Mapped[str | None] = mapped_column(String(120), nullable=True)
    attendance_status: Mapped[AttendanceStatus] = mapped_column(
        enum_col(AttendanceStatus), default=AttendanceStatus.REGISTERED
    )
    registered_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    event: Mapped[Event] = relationship(lazy="joined")
    volunteer: Mapped[Volunteer] = relationship(lazy="joined")


class FundUtilization(Base):
    __tablename__ = "fund_utilizations"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_utilization_amount_positive"),)

    utilization_id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.campaign_id"), index=True)
    category: Mapped[str] = mapped_column(String(60))
    amount: Mapped[Decimal] = mapped_column(Money)
    description: Mapped[str] = mapped_column(Text)
    reference_number: Mapped[str] = mapped_column(String(60))
    utilization_date: Mapped[date]  # date the money was actually spent
    recorded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))  # SE-6 audit trail
    recorded_date: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    campaign: Mapped[Campaign] = relationship(lazy="joined")
    recorder: Mapped[User] = relationship(lazy="joined")

    @property
    def recorded_by_name(self) -> str:
        return self.recorder.full_name


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(60), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), index=True)
    entity_id: Mapped[int | None] = mapped_column(nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class EmailLog(Base):
    """Every e-mail the system tried to send (sent / skipped because no SMTP / failed)."""

    __tablename__ = "email_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    to_email: Mapped[str] = mapped_column(String(254), index=True)
    subject: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20))  # sent | skipped | failed
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
