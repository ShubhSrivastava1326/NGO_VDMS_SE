from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import BigInteger, DateTime
from sqlalchemy.types import TypeDecorator

CENT = Decimal("0.01")


class Money(TypeDecorator):
    """Decimal rupees in Python, integer paise in the database.

    Exact on every backend (SQLite has no real DECIMAL), which satisfies CO-3:
    amounts are stored and calculated to exactly two decimal places.
    """

    impl = BigInteger
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, Decimal):
            value = Decimal(str(value))
        return int((value.quantize(CENT, rounding=ROUND_HALF_UP) * 100).to_integral_value())

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return (Decimal(int(value)) / 100).quantize(CENT)


class UTCDateTime(TypeDecorator):
    """Stores naive UTC, returns timezone-aware UTC (so JSON gets a 'Z' suffix)."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Naive datetime passed to UTCDateTime column; use timezone-aware values")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)
