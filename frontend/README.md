# VDMS Frontend: NGO Volunteer and Donation Management System

React + TypeScript + Vite + Tailwind CSS v4. It talks to the FastAPI backend in `../backend` and follows
[`../docs/FRONTEND_INTEGRATION_GUIDE.md`](../docs/FRONTEND_INTEGRATION_GUIDE.md) strictly: every path, verb and
field name lives in `src/api/services.ts` and nothing is invented or mocked.

## Run it

```powershell
# 1. backend (http://127.0.0.1:8000)
cd backend
.venv\Scripts\activate
python -m scripts.seed_demo        # optional demo data (empty DB only)
uvicorn app.main:app --port 8000

# 2. frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

`npm run dev` proxies `/api` to `http://127.0.0.1:8000` (see `vite.config.ts`), so there is no CORS to configure.
To call a backend on another origin, set `VITE_API_URL` in `.env` (see `.env.example`) and add this origin to the
backend's `CORS_ORIGINS`.

Other scripts: `npm run build` (type-check + production build), `npm run typecheck`, `npm run preview`.

Demo logins after seeding: `admin@ngo.org` / `Admin@12345`, `volunteer@demo.org` / `Demo@1234` (approved),
`pending@demo.org` / `Demo@1234` (awaiting approval). Donors: register at `/register/donor`, or donate as a guest.

## Public website redesign

The public site follows the supplied Helping Hands references: warm blush paper, berry accents,
clear Figtree typography, a custom community illustration, and photo-led campaign cards. Public styling
is scoped to `src/styles/public.css`; the operational dashboards retain their existing layout.

The homepage includes API-backed category filters, real fundraising progress, a live campaign spotlight,
volunteer registration links, upcoming events, and an accessible FAQ. No donation totals, testimonials,
or campaign records are invented. Category photos are illustrative rather than campaign documentation.

The heart logo and favicon, account artwork, campaign directory, detail cover, and donation sidebar
share the refreshed identity. Local image assets and their sources are documented in
[`DESIGN_ASSETS.md`](DESIGN_ASSETS.md).

### Motion rules
Motion handles entrances and scroll-linked effects; Lenis gently eases wheel scrolling on public pages.
Touch scrolling remains native, dialogs are excluded, and effects respect reduced-motion preferences.

| Where | What | Notes |
|---|---|---|
| Hero | Masked headline reveal, drawn heart, layered scroll parallax and subtle pointer response | Pointer motion is mouse-only; layout stays stable |
| Page sections | Staggered reveals, image zoom, interactive filter pill, floating accents | Reveals play once; decorative motion never blocks input |
| Progress / spool / slots | Draw-in once when visible | Values come straight from the API |
| Donation | Stepper thread, receipt "prints", snapped thread on failure | Never delays input or the confirm call |
| Reduced motion | Scroll smoothing and decorative motion disabled | `MotionConfig reducedMotion="user"`, hook guards and CSS |

## Structure

```
src/
  api/        client.ts (token, error envelope, retry-anonymous on expired token, downloads), services.ts, types.ts
  auth/       AuthContext, RequireRole (UI guard; the backend remains the authority)
  ui/         design system: Button, Fields, Badge/StatusPill, Dialog (native <dialog>), Toast, Tabs, Stepper,
              ThreadProgress, SlotDots, States (empty/error/skeleton), Pagination, PageHeader/Stat, Logo
  motion/     ThreadHero, ProcessThread, ThreadMoments (receipt, snap, tie), StitchCover, Reveal
  components/ CampaignViews, EventViews (incl. the documented sign-up state machine), DonationsTable, FundSpool, ...
  layouts/    PublicLayout, DashboardLayout (admin / volunteer / donor), ErrorBoundary
  pages/      public/, donor/, volunteer/, admin/   (role areas are code-split)
```

## Integration rules honoured
* Bearer JWT; one error envelope (`detail`, `code`, `errors[]`) mapped to inline field errors.
* Amounts are decimal strings and are never summed in the UI; INR formatting via `Intl` (`en-IN`).
* Dates: ISO from the API, shown as DD/MM/YYYY; `datetime-local` values are sent as explicit UTC.
* Donation flow = form → confirm → receipt (3 steps); guest `X-Donation-Token` kept in `sessionStorage`;
  failed payments offer retry (new donation + new token); double submits are blocked.
* Campaign edit locks (goal/title/category/start while active), expense cap (utilized ≤ raised), event slot
  limits, volunteer approval gate, attendance only after the event date: all enforced by the server and mirrored
  in the UI so users don't hit avoidable errors.
* PDFs/CSV are fetched with the Authorization header and saved as blobs.

## Verified (browser-driven, against the real backend)
The redesign's checks live in `tests/landing.spec.ts`. With the seeded backend and Vite running,
run `npm run test:e2e` (uses installed Google Chrome). These checks cover campaign filters, empty/error
states and retry, campaign-to-donation navigation, account forms, mobile menus, hash navigation,
FAQ controls, reduced motion, viewport overflow, and automated WCAG A/AA checks.
`npm run test:visual` saves desktop and mobile screenshots to ignored `artifacts/`.

The following is the original implementation's verification record, not a claim that the redesign
repeated every administrative workflow:
Donation success / decline → retry / refresh-restore / cancel; closed campaign blocked; volunteer registration,
duplicate-email error, approval gate, sign-up, full-event lock, task assignment, attendance; admin campaign
create → publish → edit-lock → expense cap → PDF/CSV export → early close; event create/publish; donor account,
history and receipt; role redirects; every route loads without console errors; axe-core reports 0 violations on
17 pages; keyboard-only sign-in; reduced-motion; animation loop pauses off-screen.

## Known gaps / limits
* **Guest receipts** can only be reopened while the browser session holds the donation token. The API has no
  "look up a receipt by number/e-mail" endpoint (the backend e-mails it when SMTP is configured).
* **Fund utilization is admin-only** in the API, so the public site explains the process but shows no spending figures.
* Admin donation filter loads up to 100 campaigns for its dropdown (API page-size limit).
* Payments are simulated (SRS CO-4). The "Demo controls" on the confirm step (force approve / decline) are shown only
  while the backend reports `payment_simulation_allows_forced_outcome`.
* Photographs represent cause categories; they do not depict verified beneficiaries of these demo campaigns.
