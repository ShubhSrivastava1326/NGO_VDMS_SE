import re
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, StringConstraints

from app.core.clock import to_aware_utc

# --- Money (CO-3) --------------------------------------------------------------------
# Responses: JSON *string* with exactly two decimals, e.g. "1500.00" (no float rounding).
MoneyOut = Annotated[Decimal, PlainSerializer(lambda v: f"{v:.2f}", return_type=str, when_used="json")]
# Requests: JSON number or numeric string, > 0, at most 2 decimal places.
MoneyIn = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2, examples=["500.00"])]


# --- Text / identity ---------------------------------------------------------------------
def _normalize_phone(value: str) -> str:
    cleaned = re.sub(r"[\s\-()]", "", value)
    if not re.fullmatch(r"\+?\d{7,15}", cleaned):
        raise ValueError("Enter a valid phone number (7-15 digits, optional leading +)")
    return cleaned


def _lower(value: str) -> str:
    return value.strip().lower()


def _validate_password(value: str) -> str:
    if len(value) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes")
    if not (re.search(r"[A-Za-z]", value) and re.search(r"\d", value)):
        raise ValueError("Password must contain at least one letter and one digit")
    return value


def _normalize_pan(value: str) -> str:
    cleaned = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{5,20}", cleaned):
        raise ValueError("Tax ID / PAN must be 5-20 letters or digits")
    return cleaned


Email = Annotated[EmailStr, AfterValidator(_lower)]
Phone = Annotated[str, AfterValidator(_normalize_phone), Field(examples=["+919876543210"])]
Password = Annotated[str, AfterValidator(_validate_password)]
PanTaxId = Annotated[str, AfterValidator(_normalize_pan), Field(examples=["ABCDE1234F"])]
PersonName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


def _aware(value: datetime) -> datetime:
    return to_aware_utc(value)


# Naive datetimes sent by a client are interpreted in the NGO's timezone (Asia/Kolkata by default).
AwareDatetime = Annotated[datetime, AfterValidator(_aware)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Message(BaseModel):
    detail: str
