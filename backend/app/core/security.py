from datetime import timedelta

import bcrypt
import jwt

from app.core.clock import utcnow
from app.core.config import settings
from app.models.enums import Role


def hash_password(password: str) -> str:
    """Salted one-way bcrypt hash (SE-3). The plaintext is never stored or logged."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False


def create_access_token(user_id: int, role: Role) -> tuple[str, int]:
    """Returns (token, expires_in_seconds)."""
    expires = timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "role": role.value, "iat": utcnow(), "exp": utcnow() + expires}
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)
    return token, int(expires.total_seconds())


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
