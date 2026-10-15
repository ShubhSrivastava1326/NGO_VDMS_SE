from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, conflict, unauthorized
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Donor, Role, User, Volunteer, VolunteerStatus
from app.schemas.auth import (
    AuthResponse,
    DonorRegister,
    LoginRequest,
    UserOut,
    VolunteerRegister,
)


def user_out(db: Session, user: User) -> UserOut:
    out = UserOut.model_validate(user)
    if user.role == Role.VOLUNTEER:
        vol = db.scalar(select(Volunteer).where(Volunteer.user_id == user.id))
        if vol:
            out.volunteer_id, out.volunteer_status = vol.volunteer_id, vol.status
    elif user.role == Role.DONOR:
        donor = db.scalar(select(Donor).where(Donor.user_id == user.id))
        if donor:
            out.donor_id = donor.donor_id
    return out


def auth_response(db: Session, user: User) -> AuthResponse:
    token, expires_in = create_access_token(user.id, user.role)
    return AuthResponse(access_token=token, expires_in=expires_in, user=user_out(db, user))


def phone_taken(db: Session, phone: str) -> bool:
    in_volunteers = db.scalar(select(Volunteer.volunteer_id).where(Volunteer.phone_number == phone))
    in_donors = db.scalar(select(Donor.donor_id).where(Donor.phone_number == phone, Donor.is_registered.is_(True)))
    return bool(in_volunteers or in_donors)


def _ensure_unique(db: Session, email: str, phone: str | None) -> None:  # Volunteer.Register.Validate
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise AppError(
            409, "EMAIL_ALREADY_REGISTERED", "An account with this e-mail already exists",
            errors=[{"field": "email", "message": "Already registered"}],
        )
    if phone and phone_taken(db, phone):
        raise AppError(
            409, "PHONE_ALREADY_REGISTERED", "An account with this phone number already exists",
            errors=[{"field": "phone_number", "message": "Already registered"}],
        )


def register_volunteer(db: Session, data: VolunteerRegister) -> User:
    _ensure_unique(db, data.email, data.phone_number)
    user = User(email=data.email, password_hash=hash_password(data.password), full_name=data.name, role=Role.VOLUNTEER)
    db.add(user)
    db.flush()
    db.add(
        Volunteer(
            user_id=user.id,
            name=data.name,
            phone_number=data.phone_number,
            areas_of_interest=list(data.areas_of_interest),
            availability=data.availability,
            status=VolunteerStatus.PENDING,  # Volunteer.Approve: needs admin approval
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("ALREADY_REGISTERED", "An account with this e-mail or phone number already exists")
    return user


def register_donor(db: Session, data: DonorRegister) -> User:
    _ensure_unique(db, data.email, data.phone_number)
    user = User(email=data.email, password_hash=hash_password(data.password), full_name=data.name, role=Role.DONOR)
    db.add(user)
    db.flush()
    db.add(
        Donor(user_id=user.id, name=data.name, email=data.email, phone_number=data.phone_number, is_registered=True)
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise conflict("ALREADY_REGISTERED", "An account with this e-mail already exists")
    return user


def authenticate(db: Session, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == email.strip().lower()))
    # Same error for unknown e-mail and wrong password (no account enumeration).
    if user is None or not verify_password(password, user.password_hash):
        raise unauthorized("Incorrect e-mail or password", "INVALID_CREDENTIALS")
    if not user.is_active:
        raise AppError(403, "ACCOUNT_DISABLED", "This account has been disabled")
    return user


def login(db: Session, data: LoginRequest) -> AuthResponse:
    return auth_response(db, authenticate(db, data.email, data.password))


def create_admin(db: Session, name: str, email: str, password: str) -> User:
    if db.scalar(select(User.id).where(func.lower(User.email) == email.lower())):
        raise AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this e-mail already exists")
    user = User(email=email.lower(), password_hash=hash_password(password), full_name=name, role=Role.ADMIN)
    db.add(user)
    db.commit()
    return user


def ensure_initial_admin(db: Session) -> None:
    """Startup: make sure at least one Admin exists (credentials come from .env)."""
    if db.scalar(select(User.id).where(User.role == Role.ADMIN)) is None:
        create_admin(db, settings.admin_name, settings.admin_email, settings.admin_password)
