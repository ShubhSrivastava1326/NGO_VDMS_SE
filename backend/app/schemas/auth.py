from pydantic import BaseModel, Field

from app.models.enums import Role, VolunteerStatus
from app.schemas.common import Email, ORMModel, Password, PersonName, Phone, ShortText


class VolunteerRegister(BaseModel):
    name: PersonName
    email: Email
    password: Password
    phone_number: Phone
    areas_of_interest: list[ShortText] = Field(min_length=1, max_length=20, examples=[["logistics", "teaching"]])
    availability: str | None = Field(default=None, max_length=500, examples=["Weekends, evenings"])


class DonorRegister(BaseModel):
    name: PersonName
    email: Email
    password: Password
    phone_number: Phone | None = None


class LoginRequest(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=200)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: Password


class UserOut(ORMModel):
    id: int
    email: str
    full_name: str
    role: Role
    is_active: bool
    # Filled according to role:
    volunteer_id: int | None = None
    volunteer_status: VolunteerStatus | None = None
    donor_id: int | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Seconds until the token expires")


class AuthResponse(TokenResponse):
    user: UserOut
