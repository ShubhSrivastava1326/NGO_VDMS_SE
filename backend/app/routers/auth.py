from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from app.core.deps import DB, CurrentUser
from app.core.errors import bad_request
from app.core.security import create_access_token, hash_password, verify_password
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    DonorRegister,
    LoginRequest,
    TokenResponse,
    UserOut,
    VolunteerRegister,
)
from app.schemas.common import Message
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register/volunteer",
    response_model=AuthResponse,
    status_code=201,
    summary="Register as a volunteer (account starts as 'pending' until an admin approves it)",
)
def register_volunteer(data: VolunteerRegister, db: DB):
    user = auth_service.register_volunteer(db, data)
    return auth_service.auth_response(db, user)


@router.post(
    "/register/donor",
    response_model=AuthResponse,
    status_code=201,
    summary="Register a donor account (optional: donors may also donate as guests)",
)
def register_donor(data: DonorRegister, db: DB):
    user = auth_service.register_donor(db, data)
    return auth_service.auth_response(db, user)


@router.post("/login", response_model=AuthResponse, summary="Log in with e-mail + password (JSON)")
def login(data: LoginRequest, db: DB):
    return auth_service.login(db, data)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="OAuth2 form login (used by the Swagger 'Authorize' button; the frontend should use /auth/login)",
)
def token(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: DB):
    user = auth_service.authenticate(db, form.username, form.password)
    access_token, expires_in = create_access_token(user.id, user.role)
    return TokenResponse(access_token=access_token, expires_in=expires_in)


@router.get("/me", response_model=UserOut, summary="Current user + role + profile ids")
def me(user: CurrentUser, db: DB):
    return auth_service.user_out(db, user)


@router.post("/change-password", response_model=Message)
def change_password(data: ChangePasswordRequest, user: CurrentUser, db: DB):
    if not verify_password(data.current_password, user.password_hash):
        raise bad_request("WRONG_PASSWORD", "Current password is incorrect", "current_password")
    user.password_hash = hash_password(data.new_password)
    db.commit()
    return Message(detail="Password updated")
