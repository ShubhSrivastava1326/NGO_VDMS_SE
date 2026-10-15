from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.common import Email, ORMModel, Password, PersonName


class AdminCreate(BaseModel):
    name: PersonName
    email: Email
    password: Password


class AuditLogOut(ORMModel):
    id: int
    user_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    details: dict[str, Any] | None
    created_at: datetime


class EmailLogOut(ORMModel):
    id: int
    to_email: str
    subject: str
    kind: str
    status: str
    error: str | None
    created_at: datetime
