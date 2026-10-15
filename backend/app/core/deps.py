"""Shared FastAPI dependencies: authentication, role-based access control (SE-4), pagination."""
import math
from dataclasses import dataclass
from typing import Annotated, Generic, TypeVar

from fastapi import Depends, Query
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import forbidden, unauthorized
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Donor, Role, User, Volunteer

DB = Annotated[Session, Depends(get_db)]

# auto_error=False so we can return our own error envelope and support optional auth.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/token", auto_error=False)


def _user_from_token(token: str | None, db: Session) -> User | None:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        raise unauthorized("Invalid or expired token", "INVALID_TOKEN")
    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise unauthorized("Invalid token", "INVALID_TOKEN")
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized("Account not found or disabled", "INVALID_TOKEN")
    return user


def get_current_user(token: Annotated[str | None, Depends(oauth2_scheme)], db: DB) -> User:
    user = _user_from_token(token, db)
    if user is None:
        raise unauthorized()
    return user


def get_optional_user(token: Annotated[str | None, Depends(oauth2_scheme)], db: DB) -> User | None:
    """For public endpoints that behave slightly differently for logged-in users."""
    return _user_from_token(token, db)


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_roles(*roles: Role):
    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise forbidden()
        return user

    return checker


require_admin = require_roles(Role.ADMIN)  # one shared callable so FastAPI caches it per request
AdminUser = Annotated[User, Depends(require_admin)]


def get_current_volunteer(user: Annotated[User, Depends(require_roles(Role.VOLUNTEER))], db: DB) -> Volunteer:
    vol = db.scalar(select(Volunteer).where(Volunteer.user_id == user.id))
    if vol is None:
        raise forbidden("Volunteer profile not found")
    return vol


def get_current_donor(user: Annotated[User, Depends(require_roles(Role.DONOR))], db: DB) -> Donor:
    donor = db.scalar(select(Donor).where(Donor.user_id == user.id))
    if donor is None:
        raise forbidden("Donor profile not found")
    return donor


CurrentVolunteer = Annotated[Volunteer, Depends(get_current_volunteer)]
CurrentDonor = Annotated[Donor, Depends(get_current_donor)]


# --- Pagination ---------------------------------------------------------------------
T = TypeVar("T")


@dataclass
class PageParams:
    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def page_params(
    page: Annotated[int, Query(ge=1, description="1-based page number")] = 1,
    page_size: Annotated[int, Query(ge=1, le=100, description="Items per page (max 100)")] = 20,
) -> PageParams:
    return PageParams(page=page, page_size=page_size)


Pagination = Annotated[PageParams, Depends(page_params)]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int


def make_page(items: list, total: int, params: PageParams) -> dict:
    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
        "pages": max(1, math.ceil(total / params.page_size)) if total else 0,
    }
