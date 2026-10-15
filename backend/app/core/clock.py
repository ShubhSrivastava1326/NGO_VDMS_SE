"""Time helpers. Datetimes are always timezone-aware UTC inside the app."""
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings

APP_TZ = ZoneInfo(settings.app_timezone)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def local_today() -> date:
    """'Today' in the NGO's timezone; campaign end dates are compared against this."""
    return datetime.now(APP_TZ).date()


def to_aware_utc(value: datetime) -> datetime:
    """Naive datetimes from clients are assumed to be in the NGO's timezone."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=APP_TZ)
    return value.astimezone(timezone.utc)
