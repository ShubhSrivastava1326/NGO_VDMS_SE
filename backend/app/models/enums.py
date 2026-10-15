from enum import StrEnum

from sqlalchemy import Enum as SAEnum


class Role(StrEnum):
    ADMIN = "admin"
    VOLUNTEER = "volunteer"
    DONOR = "donor"


class VolunteerStatus(StrEnum):  # Appendix A: Volunteer.status
    PENDING = "pending"
    APPROVED = "approved"
    DEACTIVATED = "deactivated"


class CampaignStatus(StrEnum):  # BR-1
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


class CampaignCloseReason(StrEnum):
    GOAL_REACHED = "goal_reached"
    END_DATE_PASSED = "end_date_passed"
    MANUAL = "manual"


class DonationStatus(StrEnum):  # BR-2
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class PaymentMethod(StrEnum):  # Donation.Payment.Select
    CARD = "card"
    UPI = "upi"
    NET_BANKING = "net_banking"


class EventStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class AttendanceStatus(StrEnum):
    REGISTERED = "registered"
    ATTENDED = "attended"
    NO_SHOW = "no_show"


def enum_col(enum_cls):
    """Store the enum *value* (lowercase, as in the data dictionary) in a VARCHAR + CHECK."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        create_constraint=True,
        length=20,
        validate_strings=True,
        values_callable=lambda e: [m.value for m in e],
        name=f"ck_{enum_cls.__name__.lower()}",
    )
