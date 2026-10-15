# NGO_VDMS_SE: NGO Volunteer and Donation Management System

Sem 5 Software Engineering project. A web application that lets an NGO run fundraising campaigns, accept donations,
organise volunteer events and report on how the money was spent.

* **Backend:** FastAPI + SQLAlchemy REST API (`backend/`)
* **Frontend:** React + TypeScript + Vite + Tailwind CSS (`frontend/`)
* **Database:** SQLite file, created automatically on first start (no database server to install)

---

## Contents

1. [What it does](#what-it-does)
2. [Prerequisites](#prerequisites)
3. [Quick start](#quick-start)
4. [Demo accounts](#demo-accounts)
5. [Try it out: a 5-minute walkthrough](#try-it-out-a-5-minute-walkthrough)
6. [Configuration](#configuration)
7. [Running the tests](#running-the-tests)
8. [Production build](#production-build)
9. [Troubleshooting](#troubleshooting)
10. [Project structure](#project-structure)
11. [Documentation](#documentation)
12. [Known limitations](#known-limitations)

---

## What it does

| Role | What they can do |
|---|---|
| **Visitor / guest** | Browse campaigns and events, donate without an account (the receipt is shown on screen, and e-mailed when SMTP is configured), read the help/FAQ |
| **Donor** | Register, donate, see donation history, download receipts, manage profile |
| **Volunteer** | Register (then wait for admin approval), sign up for events, see assigned tasks and event history |
| **Admin (NGO staff)** | Create / publish / edit / close campaigns, record fund utilization (expenses) and export PDF/CSV fund reports, manage events and attendance, approve volunteers, manage donors (incl. duplicate detection), view all donations, audit log, e-mail log, staff accounts |

Business rules worth knowing (enforced by the server):

* Money is stored as integer paise and shown as two-decimal INR; there is no float rounding anywhere.
* **Fund utilization can never exceed the amount raised** for a campaign.
* Funds can only be recorded against an **Active or Closed** campaign (not a Draft).
* Campaigns **auto-close** when the goal is reached or the end date passes.
* Events have slot limits; volunteers must be **approved** before they can sign up.
* Every fund entry is written to the **audit log** with the admin and a timestamp.

---

## Prerequisites

| Tool | Version | Check with |
|---|---|---|
| **Python** | 3.11 (what the project was built and tested on) | `python --version` |
| **Node.js** | 20.19+ or 22.12+ (required by Vite 8); npm comes with it | `node --version` |
| **Git** | any recent version | `git --version` |

Google Chrome is only needed if you want to run the browser (Playwright) tests.

---

## Quick start

You need **two terminals**: one for the backend, one for the frontend. Commands below are for **Windows PowerShell**;
macOS/Linux equivalents follow.

### 0. Get the code

```powershell
git clone https://github.com/ShubhSrivastava1326/NGO_VDMS_SE.git
cd NGO_VDMS_SE
```

### 1. Backend (terminal 1)

```powershell
cd backend
py -3.11 -m venv .venv            # or: python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m scripts.seed_demo       # loads demo campaigns, donations, events and users (only runs on an empty DB)
uvicorn app.main:app --reload --port 8000
```

Leave it running. You should see `Uvicorn running on http://127.0.0.1:8000`.

* API docs (Swagger): <http://localhost:8000/docs>

> **No `.env` is required.** Every setting has a development default. To change settings, run
> `copy .env.example .env` and edit it (see [Configuration](#configuration)).

### 2. Frontend (terminal 2)

```powershell
cd frontend
npm install
npm run dev
```

Leave it running, then open **<http://localhost:5173>** in your browser.

The dev server forwards every `/api` request to the backend on port 8000, so there is nothing to configure and no CORS
to worry about. **Start the backend first**, otherwise the site loads but shows errors where data should be.

### macOS / Linux

```bash
# backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m scripts.seed_demo
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev
```

### Where everything runs

| What | URL |
|---|---|
| **The app (open this)** | <http://localhost:5173> |
| Backend API | <http://localhost:8000> |
| Interactive API docs (Swagger) | <http://localhost:8000/docs> |
| OpenAPI spec (JSON) | <http://localhost:8000/openapi.json> |

### Stopping and restarting

Press `Ctrl + C` in each terminal. Next time you only need to activate the venv and run the two `run` commands
(`uvicorn ...` and `npm run dev`); installing and seeding are one-time steps.

### Resetting the data

The database is the file `backend/vdms.db`. To start fresh: stop the backend, delete `vdms.db` (and `vdms.db-wal` /
`vdms.db-shm` if present), run `python -m scripts.seed_demo` again, and restart the backend.

---

## Demo accounts

Created by `python -m scripts.seed_demo`:

| Role | Email | Password | Notes |
|---|---|---|---|
| Admin | `admin@ngo.org` | `Admin@12345` | Created on first start; password comes from `ADMIN_PASSWORD` in `.env` |
| Volunteer | `volunteer@demo.org` | `Demo@1234` | Approved, already signed up to an event |
| Volunteer (pending) | `pending@demo.org` | `Demo@1234` | Waiting for admin approval, so event sign-up is blocked |
| Donor | `donor@demo.org` | `Demo@1234` | Has an account; you can also register your own at `/register/donor` |

The seed also creates 4 campaigns (one Draft, two Active, one already Closed after reaching its goal), several
donations including a declined payment, recorded expenses, and 4 events. Dates are relative to the day you seed, so
re-seed on a fresh database if the campaigns have expired.

---

## Try it out: a 5-minute walkthrough

**Donate as a guest.** On the home page open a campaign, click donate, fill in your details, confirm, and the receipt
appears. The confirm step has **Demo controls** to force the simulated payment to succeed or fail.

**Run a campaign end to end (admin).**

1. Log in as `admin@ngo.org`.
2. **Campaigns → New campaign**, fill it in and save (it starts as a **Draft**).
3. Open it and click **Publish campaign**; it is now public and accepts donations.
4. Donate to it from the public site (as a guest or as the demo donor).
5. Back in the admin area, open the campaign and go to the **Fund utilization** tab.
6. Under **Record an expense**, enter category, amount, description, invoice/voucher number and date, then click
   **Record expense**. The report updates with raised / utilized / remaining and a category breakdown.
7. Export the report as **PDF** or **CSV** from the same tab.

> Recording spending is a ledger entry. The app does not move real money (see [Known limitations](#known-limitations)).

**Volunteer flow.** Register at `/register/volunteer`, then log in as admin and approve the volunteer under
**Volunteers**. The volunteer can now sign up for published events; the admin assigns tasks and marks attendance after
the event date.

---

## Configuration

All backend settings are environment variables, optionally read from `backend/.env`. Copy the template and edit:

```powershell
cd backend
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./vdms.db` | SQLite for local use; PostgreSQL also supported (`postgresql+psycopg://...`, install `psycopg[binary]`) |
| `SECRET_KEY` | dev value | JWT signing key. **Must be changed** when `ENV=production` (the app refuses to start otherwise) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@ngo.org` / `Admin@12345` | First admin, created on startup if none exists |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins (only matters if the frontend calls the API directly) |
| `MAX_SINGLE_DONATION` | `1000000.00` | Upper limit for a single donation |
| `PAYMENT_FAILURE_RATE` | `0` | Chance (0 to 1) that the simulated gateway declines a payment |
| `PAYMENT_ALLOW_FORCED_OUTCOME` | `true` | Enables the "force approve / decline" demo controls |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | empty | Real e-mail. With `SMTP_HOST` empty, e-mails are only logged (see **Admin → E-mail log**) |
| `BACKGROUND_JOBS_ENABLED` | `true` | Background loop that auto-closes campaigns / completes events |

Frontend (optional): `frontend/.env`, from `.env.example`. Leave `VITE_API_URL` **empty** for local development. Set it
to the backend origin (no trailing slash) only if the API is hosted somewhere else, and add the frontend's origin to
the backend's `CORS_ORIGINS`.

> Never commit a real `.env`; it is git-ignored.

---

## Running the tests

### Backend (pytest, 56 tests, about 45 seconds)

Uses a temporary database, so it never touches your demo data.

```powershell
cd backend
.venv\Scripts\activate
pip install -r requirements-dev.txt
pytest
```

### Frontend

```powershell
cd frontend
npm run typecheck        # TypeScript check only
npm run build            # typecheck + production build
```

Browser end-to-end tests (Playwright, uses your installed Google Chrome). The **seeded backend and the Vite dev server
must both be running**:

```powershell
cd frontend
npm run test:e2e         # functional + accessibility checks
npm run test:visual      # saves desktop/mobile screenshots to frontend/artifacts/
```

---

## Production build

```powershell
cd frontend
npm run build            # outputs static files to frontend/dist
npm run preview          # serves the build locally to check it
```

For a real deployment: serve `frontend/dist` with any static host, run the backend with `ENV=production` and a real
`SECRET_KEY`, point `VITE_API_URL` at the backend (and allow that origin in `CORS_ORIGINS`), and terminate **HTTPS** in
a reverse proxy; the app itself speaks plain HTTP.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `.venv\Scripts\activate` is blocked ("running scripts is disabled") | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first, **or** skip activating and call the venv directly: `.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000` |
| `py` is not recognised | Use `python -m venv .venv` instead (Python 3.11 recommended) |
| `pip install` fails building a package | Upgrade pip (`python -m pip install --upgrade pip`) and make sure you are on Python 3.11 |
| Site opens but lists nothing / shows API errors | The backend is not running or not on port 8000. Start it and refresh |
| `Port 5173 is already in use` | The frontend is pinned to 5173. Close the other process using it (or an old `npm run dev` window) and retry |
| `[Errno 10048]` / address already in use on 8000 | Another backend is running. Close it, or start on another port and update the proxy target in `frontend/vite.config.ts` |
| `Database already has campaigns - nothing to do.` | The seed only fills an empty database. See [Resetting the data](#resetting-the-data) |
| Login says wrong password for the admin | The admin is only created once. If you changed `ADMIN_PASSWORD` after the first start, delete `vdms.db` and restart |
| App refuses to start with `ENV=production` | Set a real `SECRET_KEY` in `.env` |
| Errors after pulling new changes that touch the database models | There is no migration tool; delete `vdms.db` and re-seed |
| `npm install` errors about the Node version | Install Node 20.19+ or 22.12+ |
| Playwright tests cannot launch the browser | Install Google Chrome, and make sure both servers are running first |

---

## Project structure

```
NGO_VDMS_SE/
├── backend/                FastAPI application
│   ├── app/
│   │   ├── main.py         app factory, CORS, routers, background maintenance loop
│   │   ├── core/           config, security (bcrypt + JWT), auth/RBAC dependencies, errors
│   │   ├── db/             engine, session, custom column types (Money, UTC datetime)
│   │   ├── models/         SQLAlchemy tables
│   │   ├── schemas/        Pydantic request/response models (the API contract)
│   │   ├── services/       all business rules (campaigns, donations, events, funds, donors, ...)
│   │   └── routers/        thin HTTP layer; routers/admin/* requires an admin token
│   ├── scripts/            seed_demo.py, export_openapi.py
│   ├── tests/              pytest suite
│   ├── requirements.txt    runtime dependencies
│   └── requirements-dev.txt  + pytest, httpx
├── frontend/               React + Vite single-page app
│   ├── src/
│   │   ├── api/            API client, typed service calls, response types
│   │   ├── auth/           login state and role guards
│   │   ├── pages/          public/, donor/, volunteer/, admin/
│   │   ├── components/     shared feature components
│   │   ├── ui/             design-system primitives (buttons, fields, dialogs, ...)
│   │   └── layouts/        public and dashboard layouts
│   ├── tests/              Playwright end-to-end tests
│   └── vite.config.ts      dev server (port 5173) and /api proxy
└── docs/                   integration guide, OpenAPI spec, project PDFs
```

---

## Documentation

* [`backend/README.md`](backend/README.md): backend design notes, configuration, concurrency and security details
* [`frontend/README.md`](frontend/README.md): frontend architecture, motion rules, integration rules, verified flows
* [`docs/FRONTEND_INTEGRATION_GUIDE.md`](docs/FRONTEND_INTEGRATION_GUIDE.md): every route, request and response (also as PDF)
* [`docs/openapi.json`](docs/openapi.json): machine-readable API contract (regenerate with `python -m scripts.export_openapi` from `backend/`)
* Live API reference while the backend runs: <http://localhost:8000/docs>

---

## Known limitations

* **Payments are simulated** behind a gateway interface; no real money moves. A real gateway (Razorpay/Stripe) can be
  plugged in without changing the donation rules.
* **"Sending funds on" means recording spending.** Fund utilization is a ledger with audit trail and reports, not a
  bank transfer.
* **E-mail is logged, not sent**, unless SMTP is configured.
* **No database migrations.** Tables are created on startup; schema changes during development mean deleting `vdms.db`.
* **Guest receipts** can only be reopened while the browser session still holds the donation token.
* Out of scope for this release: SMS/WhatsApp notifications, recurring donations, multi-branch support.
