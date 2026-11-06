# HospitalOS Mobile

An independent, Android-first, iOS-compatible hospital operating system for one multispecialty
outpatient hospital: Expo + React Native + TypeScript app, its own Express 5 API and its own
PostgreSQL 17 database. All 11 roles and all 88 reference permissions, delivered in releases R1 to
R9 ([roadmap](docs/MOBILE-IMPLEMENTATION-ROADMAP.md)).

**Status (6 November 2026):** Release 1 (outpatient operations) is built and verified on the API,
the database and the web preview, and the app has a new premium design. Release 1 is **not signed
off yet**: Android emulator and phone testing still have to be done.

## Today's updates (6 November 2026)

Two pieces of work, both waiting for review (not committed yet).

### 1. Release 1 final validation (R1.13)

- **Ran the whole system end to end** on the development database: all 11 roles sign in, see the
  right modules and are refused everything else (11/11); the full patient journey passes
  (59/59 checks): register → book → check in → nurse vitals → doctor consultation → prescription and
  lab order → pharmacy dispensing → lab results verified by a second person → invoice, part payment
  and receipt → follow-up booked.
- **Found and fixed the GitHub CI failure**: the mobile job failed on two test lines that only
  compiled on a developer machine. Fixed and proven in a clean checkout (CI goes green once pushed).
- **Fixed a security issue properly**: a crafted `hospitalos://` link could freeze the app for about
  10 seconds (a slow decoder inside Expo Router). The vulnerable code is now replaced in the app
  bundle by a safe, fast version (under 0.1 s), on top of the existing link guard.
- **Fixed a billing bug**: reprinting an older receipt showed today's balance instead of the balance
  at the time of that payment. Receipts now never change after they are issued.
- **Fixed a privacy issue**: server logs recorded patient search terms (names, phone numbers, MRNs).
  Logs now keep only the page path.
- **Checked security controls live**: token rotation and reuse detection, sign-out revoking access,
  generic password-reset answers, rate limiting, audit records, no secrets in logs, stock never
  oversold, payments never double-charged, 10 simultaneous bookings of one slot → exactly 1 succeeds.
- **Measured performance** (local): every main API call under 13 ms at p95.

### 2. Premium UI redesign (all screens)

- **New design system**: midnight navy (#080F1D), layered surfaces (#111E32, #192840), clinical cyan
  (#35D5E6), violet (#9D90FF). Every colour is checked by an automated contrast test (WCAG AA).
- **New floating bottom navigation** (Home, Queue, Search, Inbox, Profile) with an animated active
  tab; fixed the "Work Qu…" label that was cut off on small phones.
- **New Home dashboard for all 11 roles**: hospital name, greeting, a live one-line summary of the
  day, KPI cards with icons, same-day charts (patient flow, lab stages, collections), "needs
  attention" tasks and quick actions only for what the role is allowed to do. **All figures are
  real, from the server**; no invented numbers or fake trends.
- **Every screen redesigned**: sign-in, splash, onboarding, work queue, patient search, patient
  record, booking, registration, chart (allergy warning next to the patient's name, vitals as
  tiles), consultation, vitals, dispensing, lab order (stage tracker), invoice (clear totals,
  receipt view), follow-ups, staff accounts, nurse sessions, inbox, profile, settings.
- **Safer and clearer interactions**: ordering a lab test now asks for confirmation; selected options
  are highlighted and announced to screen readers; new offline and "not available for your role"
  screens; loading placeholders shaped like the content.
- **Smooth, restrained animation** that turns off when the phone's "reduce motion" setting is on.
- **Tests**: mobile tests went from 232 to **304**, all passing.

## What is not done yet

- **Android testing** on an emulator and a physical phone (no Android SDK on the development Mac).
  This is the remaining gate for Release 1 sign-off.
- **Commit and push** of today's work (waiting for owner review); GitHub CI shows red until then.
- Trend charts need a history API (not built); haptics need an approved new package; invoice
  discounts and tax are not in Release 1.
- The Expo patch update (fixes one development-tool advisory) is scheduled for 19 November under the
  package-age policy.

## Project timeline (from the beginning)

| Date    | Work                                                                                                                                                      | Result                  |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 5 Nov   | Project set up as design-first; product boundaries and planning documents                                                                                 | PR #1 merged            |
| 5 Nov   | Glassmorphism dashboard design foundation                                                                                                                 | PR #1                   |
| 5 Nov   | Expo app bootstrap: design system, navigation shell, splash, onboarding, sign-in screens                                                                  | PR #2 merged            |
| 5 Nov   | Phase 1.0: 11 roles and 88 permissions aligned with the reference; five-tab navigation; Inbox placeholder                                                 | PR #3 merged            |
| 5–6 Nov | Phase 1.1: independent backend (Express 5, PostgreSQL 17, Drizzle), isolated Docker database, migrations, readiness checks, CI, secret scanning           | Merged to `main`        |
| 6 Nov   | Release 1 outpatient operations: authentication, patients, scheduling, consultations, nursing, pharmacy, laboratory, billing, follow-ups, live dashboards | PR #5 merged            |
| 6 Nov   | R1.13 validation: end-to-end run, CI fix, security, billing and logging fixes                                                                             | Uncommitted, for review |
| 6 Nov   | Premium UI redesign of every screen and all 11 dashboards                                                                                                 | Uncommitted, for review |

## Features (Release 1)

**Accounts and security**

- Staff sign-in (no public registration; HR creates accounts), forgot/reset password by emailed code,
  change password, forced password change, sign out and sign out everywhere.
- Short-lived access tokens, rotating refresh tokens kept in the phone's secure keystore, reuse
  detection, idle (30 min) and absolute (12 h) session limits, lockouts and rate limits.
- Every request is authorized on the server by permission and by record (care relationship, nurse
  assignment). Every sensitive read and write is audited. Incoming links are checked before use.

**Roles (11)**: Super Admin, Hospital Administrator, HR Manager, Receptionist, Doctor, Nurse,
Pharmacist, Laboratory Technician, Finance/Billing, Inventory Manager, Marketing/Outreach. Each sees
its own Home dashboard, modules and work queue.

**Reception**: register patients with an automatic MRN and duplicate warning, search by MRN, phone or
name, doctor availability, booking (double-booking impossible), walk-ins, check-in with a queue token,
cancel, reschedule, no-show, follow-up booking.

**Doctor**: personal queue, consultation (notes, diagnoses, addenda after completion), allergies,
prescriptions with an allergy check, lab orders, follow-up recommendations, full chart.

**Nursing**: assigned sessions, vitals for patients in those sessions only, allergies.

**Pharmacy**: prescription queue, first-expiry-first-out dispensing (expired, recalled or quarantined
stock is never used), near-expiry confirmation, stock movements, medicine lines on the bill.

**Laboratory**: worklist, sample collection with barcode, processing, results with low/normal/high
flags, verification by a different person, results on the patient's chart.

**Billing**: one draft bill per visit (consultation, lab and medicines added automatically), issue
with a gapless invoice number, issued invoices locked, part payments, receipts, corrections for
cancelled services, all amounts in whole paise.

**Dashboards**: live per-role figures from the database; demo figures only in the development demo,
always labelled DEMO DATA.

**By the numbers**: 86 API routes, 88 permissions, 11 roles, 5 database migrations; tests: 304
mobile, 50 API, 71 database, 9 contracts, all passing.

## Run the whole project

With Docker Desktop running and the one-time setup below done:

```sh
npm run db:up          # start our PostgreSQL (port 5433)
npm run mail:up        # start the development email catcher (password reset codes)
npm run start:api      # API on http://127.0.0.1:4000  (check /api/health and /api/ready)
cd apps/mobile
npm run web            # app in the browser on http://localhost:8081
npm run android        # or on an Android emulator/phone (needs Android Studio)
```

Development sign-in uses the synthetic demo accounts created by `npm run db:seed:demo -- dev`
(development and test databases only; new random passwords are printed once and never stored).

## Product boundaries

- Separate from the HospitalOS web application, which is a requirements reference only. This
  project never connects to, reuses or modifies its code, database, credentials or Docker resources.
- The app talks to the API over HTTPS only; it never connects to PostgreSQL.
- The API authorizes every request. Hiding a button is never security.
- Synthetic data only. No diagnosis, treatment or dose recommendations.

## Repository layout

```text
apps/
  mobile/          Expo app (own lockfile; reads the shared contracts from source)
  api/             Independent API: Express 5, Zod, Drizzle, PostgreSQL 17
packages/
  contracts/       The one shared package: roles, 88 permissions, API schemas, error codes
docker/postgres/   Database role and database creation script (run by an approved step)
scripts/           env-init, secrets-check, iso-check, db-init
docs/              Planning documents, decisions, build log, quality gates, known issues
docker-compose.yml Local PostgreSQL (project "hospitalos-mobile", 127.0.0.1:5433)
```

The root npm workspace contains `apps/api` and `packages/*` only, so the Expo app is unaffected
(decision AD-M-011).

## Local development

Requirements: Node.js 24 (`.nvmrc`), npm 11, Docker Desktop.

**Mobile app:** see [`apps/mobile/README.md`](apps/mobile/README.md).

**API and database**. First-time setup, in order:

| Step | Command                                            | What it does                                                            |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| 1    | `npm ci`                                           | Installs the API and contracts dependencies (root lockfile)             |
| 2    | `npm run env:init`                                 | Writes the root `.env` with random secrets (git-ignored, mode 600)      |
| 3    | `npm run iso:check`, then `npm run db:up`          | Checks names and ports, then starts our PostgreSQL container            |
| 4    | `npm run db:init`                                  | Creates `hospitalos_dev`, `hospitalos_test`, `hos_owner` and `hos_app`  |
| 5    | `npm run db:migrate` and `npm run db:migrate:test` | Applies migrations as `hos_owner`                                       |
| 6    | `npm run dev:api`                                  | Starts the API on `http://127.0.0.1:4000` (`/api/health`, `/api/ready`) |

Checks: `npm run check` (secrets, types, lint, format, unit tests) and `npm run test:db`.
Stop the database with `npm run db:down` (keeps the data volume). CI runs the same steps on every
push and pull request (`.github/workflows/ci.yml`) with throwaway credentials.

### Isolation from the reference project

|                   | Reference                                      | HospitalOS Mobile                                            |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Compose project   | `hospitalos`                                   | `hospitalos-mobile`                                          |
| Network / volume  | `hospitalos_default` / `hospitalos_hms_pgdata` | `hospitalos-mobile-network` / `hospitalos-mobile-pgdata`     |
| PostgreSQL port   | 5432                                           | 5433                                                         |
| API port          | 3000                                           | 4000                                                         |
| Databases / users | `hms_dev`, `hms_test` / `hms_owner`, `hms_app` | `hospitalos_dev`, `hospitalos_test` / `hos_owner`, `hos_app` |

The API refuses to start against any database or user outside this list.

## Secrets

Secrets live only in the git-ignored root `.env`, generated locally. They never
appear in code, documentation, logs, screenshots or the app bundle. `npm run secrets:check` fails
if one is found in any file Git tracks or would track.

## Documentation

- [Product scope](docs/MOBILE-PRODUCT-SCOPE.md) · [Roles and permissions](docs/MOBILE-ROLE-MODULE-MATRIX.md) ·
  [Workflows](docs/MOBILE-WORKFLOWS.md) · [Architecture](docs/MOBILE-ARCHITECTURE.md) ·
  [Roadmap](docs/MOBILE-IMPLEMENTATION-ROADMAP.md) · [Test strategy](docs/MOBILE-TEST-STRATEGY.md)
- [Architecture decisions](docs/ARCHITECTURE-DECISIONS.md) · [Build log](docs/BUILD-LOG.md) ·
  [Quality gates](docs/QUALITY-GATES.md) · [Known issues](docs/KNOWN-ISSUES.md)
- [Design system](docs/DESIGN-SYSTEM.md) · [UI gap report](docs/UI-VISUAL-GAP-REPORT.md) ·
  [Release 1 report](docs/R1-RELEASE-REPORT.md)
