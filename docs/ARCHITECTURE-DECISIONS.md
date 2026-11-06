# Architecture decisions

The record of every architecture decision and every deliberate difference from the reference
HospitalOS web project. Each entry says what was decided, why, and who approved it. Details live
in the planning documents linked from each entry. Nothing here changes the reference's
requirements silently.

Status values: **Approved** (owner approved), **Proposed** (awaiting approval), **Superseded**.

## Decisions

| ID | Decision | Status | Where |
|---|---|---|---|
| AD-M-001 | Expo + React Native + TypeScript (Expo SDK 57), Android first, iOS from the same code | Approved 2026-11-05 (MD-1) | Scope §2 |
| AD-M-002 | Independent backend: Node.js 24, Express 5, TypeScript, Zod, Drizzle ORM, PostgreSQL 17; never Fastify or Prisma | Approved 2026-11-05 (MD-2) | Architecture §1–4 |
| AD-M-003 | Independent database; never connect to, reuse or migrate the reference's backend or database | Approved 2026-11-05 (MD-3) | Architecture §7 |
| AD-M-004 | Releases R1 to R9; all 11 roles and 88 permissions kept | Approved 2026-11-05 (MD-4, MD-9) | Roadmap |
| AD-M-005 | Navigation: Home, Work Queue, Search, Inbox, Profile | Approved 2026-11-05 (MD-6) | Matrix §7 |
| AD-M-006 | The backend owns all data; seeds live in PostgreSQL and reach the app through the API | Approved 2026-11-05 (MD-12) | Architecture §6 |
| AD-M-007 | Seeds and accounts: no default or shared passwords; audited Super Admin bootstrap; demo accounts only in development and test | Approved 2026-11-05 (MD-20) | Architecture §6.3 |
| AD-M-008 | Minimal staff-account administration in R1 | Approved 2026-11-05 (MD-23) | Roadmap 1.2b |
| AD-M-009 | **One canonical shared package, `packages/contracts`** (roles, 88 permissions, API schemas, validation contracts, common types). No `packages/shared`. The backend alone makes authorization decisions | Approved 2026-11-05 (D1, phase 1.1) | Architecture §2 |
| AD-M-010 | **End-of-day job in Release 2**, as an addition beyond the built reference; its schedule, reconciliation, idempotency, recovery and audit rules are reviewed before R2 | Approved 2026-11-05 (D2, phase 1.1) | Workflows §6 |
| AD-M-011 | **Workspace migration in two steps.** Phase 1.1: root npm workspace with `apps/api` and `packages/*` only; `apps/mobile` stays outside with its own lockfile. Phase 1.2: the mobile app joins when it first imports `@hospitalos/contracts`, as its own verified step. Evidence: Expo's `resolveWorkspaceRoot` returns no workspace root for a project left out of the workspace list, so Metro keeps `apps/mobile` as its root | Approved with the phase 1.1 plan | Architecture §2 |
| AD-M-012 | **Migrations:** forward-only SQL files applied by our own runner with SHA-256 checksums and an advisory lock; drizzle-kit only generates SQL for review and never connects to a database | Approved with the phase 1.1 plan | `apps/api/README.md` |
| AD-M-013 | **Database identity guard:** the API refuses any database outside `DATABASE_ALLOWED_NAMES` (only `hospitalos_*` names accepted), any user other than `hos_app`, and any over-privileged user; migrations do the same with `hos_owner` | Approved with the phase 1.1 plan | Architecture §7 |
| AD-M-014 | Local PostgreSQL container is never restarted automatically (`restart: 'no'`) and binds only to `127.0.0.1:5433`; project databases and roles are created by a separate, approved script, not at container start | Approved with the phase 1.1 plan | `docker-compose.yml` |
| AD-M-015 | **Readiness reads migration state:** `hos_app` gets SELECT only on `schema_migrations` (granted by the migration runner) so `/api/ready` can compare recorded migrations with the build. No INSERT, UPDATE, DELETE, TRUNCATE, schema CREATE, ownership or migration rights; verified by database tests | Approved 2026-11-05 (owner, phase 1.1 review) | `apps/api/README.md` |
| AD-M-016 | **CI gates.** API job: every step blocks. Mobile job: typecheck, lint, Prettier and Jest block; the dependency audit blocks on any high or critical advisory not classified in `scripts/mobile-audit-exceptions.json` (each with a review date; critical never exempt; classified ones are printed as warnings); Expo Doctor is report-only until the Expo patch upgrade is approved (KI-9). CI credentials are random per run, never repository secrets | Approved 2026-11-05 (owner, phase 1.1 review) | `.github/workflows/ci.yml`, KI-12 |
| AD-M-017 | **Incoming-link guard (first task of phase 1.2, kept active in production):** every incoming link is checked before Expo Router parses it. Only the app's own scheme (`hospitalos://`) and an explicit allow-list of in-app destinations pass; unknown schemes (`javascript:`, `data:`, `file:`, `intent:`, `http(s):` and others), malformed or over-long URLs and undecodable percent-encoding are sent to a safe screen. Untrusted input can never trigger external navigation. Security tests cover allowed and rejected URLs. No external-link feature is added before the guard exists. Mitigates KI-12 until Expo SDK 58 | Approved 2026-11-06 (owner) | KI-12 |

## Deliberate differences from the reference

| ID | Difference | Reason | Status |
|---|---|---|---|
| M-ADR-1 | Opaque access token + rotating refresh token (SecureStore) instead of a cookie session with CSRF | A native app has no browser cookie store | Approved (MD-5) |
| M-ADR-2 | Emailed 8-digit code instead of a reset link | No web page for a link to open | Approved (D4) |
| M-ADR-3 | Server-Sent Events kept, authenticated with the bearer token and read with Expo's streaming `fetch` | The browser `EventSource` can't send an `Authorization` header | Approved (D5) |
| M-ADR-4 | Push notifications with preferences and privacy-safe lock-screen text | Staff are often away from the screen | Approved in principle (D5); the outside-service connection needs approval in R7 |
| M-ADR-5 | LiveKit only, no peer-to-peer fallback | Mobile networks rarely connect peer to peer | Approved (D5); infrastructure approved in R8 |
| M-ADR-6 | Own Compose project, network, volume, databases, users, ports and environment files | Run beside the reference without touching it | Approved (MD-13) |
| M-ADR-7 | R1 views receipts and lab reports in the app only; export and sharing deferred | Exported files carry patient data out of the app | Approved (D2 of the review); export design needs its own approval |
| M-ADR-8 | Billing corrections resolved by Finance instead of automatic credit notes | Owner decisions MD-11, D1, D3 | Approved |
| M-ADR-9 | End-of-day job built here although the reference only designed it | It completes time-based states (no-shows, missed follow-ups, prescription closure) | Approved for R2 (AD-M-010) |
