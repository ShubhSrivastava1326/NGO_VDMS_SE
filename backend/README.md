# VDMS Backend: NGO Volunteer and Donation Management System

FastAPI + SQLAlchemy REST API implementing the SRS (Release 1.0). The React frontend is built separately; see
[`../docs/FRONTEND_INTEGRATION_GUIDE.md`](../docs/FRONTEND_INTEGRATION_GUIDE.md) (also as PDF) for routes, wiring and examples.

## Run it

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env                 # optional; every setting has a dev default
python -m scripts.seed_demo            # optional demo data (empty DB only)
uvicorn app.main:app --reload --port 8000
```

* Swagger UI: <http://localhost:8000/docs> · OpenAPI: <http://localhost:8000/openapi.json>
* The SQLite file `vdms.db` and the first admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, default `admin@ngo.org` / `Admin@12345`) are created on first start.
* Tests: `pip install -r requirements-dev.txt` then `pytest` (56 tests, ~45 s).
* Export the API contract for the frontend: `python -m scripts.export_openapi` writes `../docs/openapi.json`.

## Layout

```
app/
  main.py            app factory, CORS, router wiring, background maintenance loop
  core/              config (env), security (bcrypt + JWT), deps (auth/RBAC/pagination), errors, clock
  db/                engine/session, custom column types (Money = integer paise, UTCDateTime)
  models/            SQLAlchemy tables (Appendix A of the SRS + users, audit_logs, email_logs)
  schemas/           Pydantic request/response models  (= the API contract)
  services/          all business rules (campaigns, donations, events, funds, donors, ...)
  routers/           thin HTTP layer; routers/admin/* is guarded by one admin dependency
scripts/             seed_demo.py, export_openapi.py
tests/               pytest suite mapped to SRS requirements
```

Routers stay thin and call `services/`; rules such as "utilized ≤ raised" or "event is full" live only in the service layer.

## Configuration (`.env`)

See [`.env.example`](.env.example). The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `sqlite:///./vdms.db` (lab) or `postgresql+psycopg://…` (install `psycopg[binary]`) |
| `SECRET_KEY` | JWT signing key. **Must be changed** when `ENV=production` (the app refuses to start otherwise) |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `MAX_SINGLE_DONATION` | The configurable single-donation limit (SRS TBD-1) |
| `PAYMENT_FAILURE_RATE`, `PAYMENT_ALLOW_FORCED_OUTCOME` | Control the simulated payment gateway (demo/testing) |
| `SMTP_*` | Real e-mail. With `SMTP_HOST` empty, e-mails are only logged (see `GET /api/v1/admin/email-log`) |

## Key design points

* **Money** is stored as integer paise and exposed as two-decimal strings (SRS CO-3): no float rounding anywhere.
* **Payments are simulated** behind a `PaymentGateway` interface (`services/payment.py`); a Razorpay/Stripe implementation can replace it without touching the donation rules (SRS SI-2.2).
* **Concurrency:** confirming a donation, taking the last event slot and recording fund utilization run inside one critical section (plus `SELECT … FOR UPDATE` on PostgreSQL), so parallel requests can't double-count or overbook. This was verified with parallel HTTP requests against a live server.
* **Auto-close** of campaigns (goal reached / end date passed) happens on write, on every read that lists campaigns, and in a 60-second background loop.
* **Security:** salted bcrypt hashes, JWT bearer auth, role checks on every protected route, donors can only read their own data, fund entries are audit-logged with admin id + timestamp.
* **HTTPS** (SRS CI-3/SE-1) is expected at the deployment layer (reverse proxy / platform TLS); the app itself speaks HTTP.

## Not included (per the SRS "future releases")

Real payment gateway, SMS/WhatsApp, recurring donations, multi-branch support. A database migration tool (Alembic) is also not set up: tables are created on startup with `create_all`, so schema changes during development mean deleting `vdms.db`.
