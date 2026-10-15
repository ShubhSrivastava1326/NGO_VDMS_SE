from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.clock import utcnow
from app.db.session import Base
from app.db.types import UTCDateTime
from app.models.enums import Role, VolunteerStatus, enum_col


class User(Base):
    """Login identity. One user has exactly one role (SE-4)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)  # stored lower-case
    password_hash: Mapped[str] = mapped_column(String(128))  # salted bcrypt (SE-3)
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(enum_col(Role), index=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Volunteer(Base):
    __tablename__ = "volunteers"

    volunteer_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    phone_number: Mapped[str] = mapped_column(String(20), unique=True)
    areas_of_interest: Mapped[list] = mapped_column(JSON, default=list)
    availability: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[VolunteerStatus] = mapped_column(
        enum_col(VolunteerStatus), default=VolunteerStatus.PENDING, index=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    status_changed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    user: Mapped[User] = relationship(lazy="joined")

    @property
    def email(self) -> str:
        return self.user.email


class Donor(Base):
    """A person/organisation that has donated (registered account or guest)."""

    __tablename__ = "donors"

    donor_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(254), index=True)  # NOT unique: see Donor.Merge.Flag
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_registered: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
