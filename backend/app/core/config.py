from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_SECRET = "dev-only-secret-change-me-before-deploying-0123456789"


class Settings(BaseSettings):
    """All configuration comes from environment variables / a .env file."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- General -----------------------------------------------------------------
    app_name: str = "NGO Volunteer and Donation Management System"
    ngo_name: str = "Helping Hands NGO"
    env: str = "development"  # development | production | test
    api_prefix: str = "/api/v1"
    app_timezone: str = "Asia/Kolkata"  # used for "today" (campaign end dates) and naive datetimes
    currency: str = "INR"  # AS-2

    # --- Database (OE-3): SQLite for the lab, PostgreSQL for production ----------------
    database_url: str = "sqlite:///./vdms.db"

    # --- Auth (SE-3) -----------------------------------------------------------------
    secret_key: str = _DEV_SECRET
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8

    # --- CORS (frontend origins, comma separated) ------------------------------------
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    # --- Donations -------------------------------------------------------------------
    max_single_donation: Decimal = Decimal("1000000.00")  # TBD-1 (configurable limit)
    payment_failure_rate: float = 0.0  # 0..1, random failure chance of the simulated gateway
    payment_allow_forced_outcome: bool = True  # let clients pass simulate_outcome (demo/testing)

    # --- E-mail (DE-1). If smtp_host is empty, e-mails are logged, not sent -----------
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "no-reply@ngo.local"

    # --- First admin account (created on startup if no admin exists) ---------------------
    admin_email: str = "admin@ngo.org"
    admin_password: str = "Admin@12345"
    admin_name: str = "NGO Admin"

    # --- Background jobs (auto-close campaigns, auto-complete events) -----------------
    background_jobs_enabled: bool = True
    background_interval_seconds: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"

    def assert_safe_for_production(self) -> None:
        if self.is_production and self.secret_key == _DEV_SECRET:
            raise RuntimeError("SECRET_KEY must be set to a strong random value when ENV=production")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
