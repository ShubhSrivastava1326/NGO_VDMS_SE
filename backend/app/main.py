import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_error_handlers
from app.db.session import SessionLocal, init_db
from app.routers import admin, auth, campaigns, donations, donors, events, meta, volunteers
from app.services.auth import ensure_initial_admin
from app.services.campaigns import sync_all_campaigns
from app.services.events import sync_event_statuses

log = logging.getLogger("vdms")

DESCRIPTION = """
REST API for the **NGO Volunteer and Donation Management System** (SRS Release 1.0).

* Auth: `POST /api/v1/auth/login` -> use the returned token as `Authorization: Bearer <token>`.
* All `/api/v1/admin/**` routes need an Admin token.
* Money values in responses are **strings with two decimals** (e.g. `"1500.00"`).
* Errors always look like `{ "detail": "...", "code": "...", "errors": [{"field","message"}] }`.
"""


def run_maintenance() -> None:
    """Campaign.Close.Auto and event auto-completion. Safe to run any time, idempotent."""
    with SessionLocal() as db:
        closed = sync_all_campaigns(db)
        completed = sync_event_statuses(db)
        if closed or completed:
            log.info("maintenance: closed %s campaign(s), completed %s event(s)", closed, completed)


async def _maintenance_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(run_maintenance)
        except Exception:
            log.exception("maintenance job failed")
        await asyncio.sleep(settings.background_interval_seconds)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.assert_safe_for_production()
    init_db()
    with SessionLocal() as db:
        ensure_initial_admin(db)
    task = asyncio.create_task(_maintenance_loop()) if settings.background_jobs_enabled else None
    yield
    if task:
        task.cancel()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=DESCRIPTION,
        lifespan=lifespan,
        openapi_tags=[
            {"name": "Auth", "description": "Register, log in, current user"},
            {"name": "Campaigns (public)", "description": "Browse active campaigns - no login"},
            {"name": "Donations", "description": "Guest or donor donation flow, receipts"},
            {"name": "Events (volunteers)", "description": "Browse and sign up for events"},
            {"name": "Volunteer (self)", "description": "Role: volunteer"},
            {"name": "Donor (self)", "description": "Role: donor"},
            {"name": "Admin: campaigns & funds", "description": "Role: admin"},
            {"name": "Admin: events", "description": "Role: admin"},
            {"name": "Admin: people & logs", "description": "Role: admin"},
            {"name": "Meta", "description": "Config, enums, FAQ"},
        ],
    )
    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],  # lets the frontend read the download filename
    )

    prefix = settings.api_prefix
    for r in (
        auth.router,
        campaigns.router,
        donations.router,
        events.router,
        volunteers.router,
        donors.router,
        admin.router,
        meta.router,
    ):
        app.include_router(r, prefix=prefix)

    @app.get("/health", tags=["Meta"], summary="Liveness check")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
