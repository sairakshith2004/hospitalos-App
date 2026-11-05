# HospitalOS Mobile: architecture

Status: **final draft for owner review**, 2026-11-05 (all owner decisions of 2026-11-05 applied,
including D1 to D6 and the Release 1 corrections). Decisions MD-1 to MD-23 are in the
[product scope](MOBILE-PRODUCT-SCOPE.md#2-approved-decisions-owner-2026-11-05); the decision summary
is [section 12](#12-architecture-decision-summary).

## 1. Shape

A mobile client and a **modular monolith** backend, both in this repository, with their own
PostgreSQL 17 database. It follows the reference architecture (one Express API, domain modules,
one database, one set of transaction tools) with a mobile client in place of the browser.

```text
Android / iOS app (Expo, React Native)
  │ HTTPS · JSON · Authorization: Bearer <opaque access token>
  │ (refresh token only sent to /v1/auth/token)
  ▼
apps/api (Express 5, Node.js 24)
  helmet → requestId → pino (redacted) → rateLimit → authenticate (token → session → user active?)
  → passwordChosen check → route: validate (Zod) → requirePermission(code) → controller
  → service: business rules · record-level access · one transaction · audit row
  → repo (Drizzle) → PostgreSQL 17 (hospitalos_dev / hospitalos_test)
  errorHandler → { error: { code, message, requestId } }
  SSE /v1/events (R7) · push sender (R7) · LiveKit pass issuer (R8) · SMTP (reset codes)
```

**Independence.** This product never calls the reference API, never opens its database and shares
no credentials with it. Database names, database roles, ports and Docker volumes are deliberately
different (section 6) so the two can run on one laptop without touching each other.

## 2. Repository layout

```text
apps/
  mobile/                 Expo app (exists today; Expo SDK 57, Expo Router)
    src/app/              routes only (thin files)
    src/features/<domain>/screens, hooks, domain helpers
    src/components/       design system (exists)
    src/services/api/     typed API client, auth/session manager, query keys
    src/theme/            tokens (exists)
  api/                    Express API (Release 1, phase 1.1)
    src/config/env.ts     Zod-validated environment; fails at start-up naming the setting, never the value
    src/db/schema/        Drizzle tables, one file per domain
    src/db/migrations/    forward-only SQL (generated + hand-written: EXCLUDE, triggers, grants)
    src/db/seed/          reference data (roles, permissions) for every environment; synthetic
                          demo data for development and test only (section 6.3)
    src/cli/              bootstrap-admin, reset-password (audited operator commands)
    src/lib/              audit, tx, money, time, numbering, idempotency, errors, tokens
    src/middleware/       authenticate, requirePermission, rateLimit, errorHandler
    src/modules/<domain>/ *.routes · *.service · *.repo · *.schemas · *.test
packages/
  shared/                 roles, the 88 permissions, role → permission map, Zod request/response
                          schemas, enums: imported by both apps so they can never disagree
docker-compose.yml        PostgreSQL 17 (+ Mailpit for reset codes; LiveKit in R8)
docs/
```

Turning the repository into npm workspaces (root `package.json` with `apps/*` and `packages/*`)
happens in phase 1.1 and needs approval, because it moves the mobile app's lockfile to the root.
Expo SDK 57 supports workspaces through Metro's automatic monorepo configuration.

**Backend modules:** `auth`, `users`, `access`, `audit`, `settings`, `patients`, `departments`,
`doctors`, `appointments` (with follow-ups and the end-of-day job), `clinical`, `prescriptions`,
`pharmacy`, `inventory`, `billing`, `laboratory`, `hr`, `finance`, `equipment`, `marketing`,
`reports`, `communication`, `meetings`. Modules call each other's services, never each other's
tables.

## 3. Rules every backend module follows

These are the reference's rules (its `docs/architecture.md` §3), kept unchanged:

1. Routes only validate input, check permissions and delegate. Business rules live in services.
2. Any operation that writes more than one row runs in one database transaction.
3. The acting user comes from the server-validated token, never from the request body or query.
4. Authorization on every request: `requirePermission` at the route, then a record-level check in
   the service through the `access` module (care relationship, nurse assignment, ownership).
5. The database backs up the rules: FK, composite FK, CHECK, UNIQUE, EXCLUDE and deferred triggers.
6. Nothing clinical, financial or audit-related is hard-deleted. FKs are `ON DELETE RESTRICT`.
7. Audit rows are written in the same transaction as the change. A clinical read writes its audit
   row before data is returned; if that fails, the request fails.
8. Logs never contain patient fields, passwords, tokens, codes or session IDs (pino redaction plus a
   log-capture test).
9. "Today" is computed on the server in the hospital time zone. The phone's clock is never trusted.
10. Safety rules (expiry, substitution, discount limits, stock) live in services with database
    constraints behind them. The app may show the same rules, never as the only check.

**Global lock order** (deadlock avoidance): appointment → prescription → prescription items →
stock batches (ascending id) → invoice → payment → document counter.

## 4. Data

PostgreSQL 17, the reference's schema design (`docs/erd.md`) as the starting point, rebuilt here
with our own migrations. The table list per release is in the roadmap.

| Concern | Rule |
|---|---|
| Keys | `uuid` (`gen_random_uuid()`); movements and audit rows use `bigint` identity |
| Human numbers | Sequences for MRN, appointment, encounter, prescription, lab order, dispensing; gapless per fiscal year from a row-locked `document_counters` table for invoices, receipts, credit notes and refunds |
| Money | `bigint` paise, integer maths only; percentages in basis points (1000 = 10%) |
| Time | `timestamptz`; `date` only for birth dates, expiry, visit dates and follow-up windows; Asia/Kolkata |
| Optimistic locking | `version` on patients, appointments, prescriptions, invoices; stale write → 409 |
| Idempotency | `Idempotency-Key` header stored with a request hash in `idempotency_keys`; replay returns the stored result; reuse with a different body → 422 |
| Database roles | `hos_owner` runs migrations; `hos_app` runs the API with no DELETE on clinical, financial or audit tables and INSERT-only on `audit_logs`. The API refuses to start as any other role. |
| Extensions | `pgcrypto`, `citext`, `pg_trgm`, `btree_gist` |
| Settings | Single-row `hospital_settings`, each key owned by one permission (system, security, operational); security limits in section 5.6 |
| Migrations | Forward-only, checksummed, never edited after being applied; every change to a shared dev database after a verified `pg_dump` backup and owner approval |

**Tables new in this product** (not in the reference): `auth_sessions`, `auth_tokens`,
`password_reset_codes` and `billing_corrections` (R1), `push_devices` and `push_preferences` (R7),
`document_shares` (with document sharing), `day_close_runs` (R2). The first three replace
the reference's cookie `sessions` table; `billing_corrections` implements MD-11
([workflows §4](MOBILE-WORKFLOWS.md#4-billing-corrections-when-a-service-is-cancelled)).

## 5. Authentication and sessions

### 5.1 Why not the reference's cookies

The reference uses a server-side session behind an `httpOnly` cookie plus a CSRF token. That fits a
browser: the browser stores the cookie where page scripts can't read it, and it **attaches the
cookie automatically to every request to the API, even one started by another website**. CSRF
protection exists only to stop that automatic attachment from being abused.

A native app has no cookie jar shared with websites and nothing sends its credentials
automatically. It attaches a token itself, in the `Authorization` header, only to our API. So:

| | Browser reference | Mobile |
|---|---|---|
| Credential | Session cookie, `httpOnly`, `Secure`, `SameSite=Lax` | Opaque bearer access token + refresh token |
| Sent by | The browser, automatically | The app, explicitly, per request |
| Stored in | Browser cookie store | Access token in memory; refresh token in Android Keystore / iOS Keychain via `expo-secure-store` |
| CSRF token | Required | Not needed (no ambient credential). The API ignores cookies entirely. |
| Revocation | Delete the session row | Revoke the session row; every token belonging to it stops working on the next request |

**Why opaque tokens and not JWTs.** A JWT is valid until it expires unless every request also checks
a deny list, and it would carry permissions that go stale. The reference rejected JWTs for the same
reason (its ADR 0004). Our tokens are random strings with no meaning; the API looks each one up,
which gives instant revocation and fresh permissions on every request (the reference's AD-8).

### 5.2 Tokens

| Item | Value |
|---|---|
| Format | `hos_at_` / `hos_rt_` + 32 random bytes (base64url) from `crypto.randomBytes` |
| Stored on the server | SHA-256 of the token only (the token has 256 bits of entropy, so a fast hash is safe). The plaintext is returned once and never stored or logged. |
| Access token lifetime | 15 minutes |
| Refresh token | Single use. Each refresh returns a new access token **and** a new refresh token, and marks the old one used. |
| Session idle limit | 30 minutes without a successful request or refresh (`session_idle_minutes`, security setting) |
| Session absolute limit | 12 hours from sign-in (`session_absolute_hours`, security setting), whatever the activity |
| Session record | `auth_sessions`: user, device label (user-visible, e.g. "Pixel 8"), created, last used, idle and absolute expiry, revoked at, revoke reason. One session = one token family. |

**Every request** (`authenticate` middleware): hash the bearer token → find an unexpired, unrevoked
access token → its session is unrevoked and inside both limits → the user is `active` → load roles
and permissions fresh → slide the idle expiry. Any failure → `401 UNAUTHENTICATED` with no detail.

### 5.3 Session lifecycle

| Event | Endpoint | What happens | Audit |
|---|---|---|---|
| Sign in | `POST /v1/auth/sessions` `{ username, password, deviceLabel }` | Rate limit and per-IP lockout checked; argon2id verify (dummy hash for unknown users); new session and token pair. Response: `{ accessToken, refreshToken, accessExpiresAt, user }` | `auth.login.succeeded` / `.failed` / `.locked` |
| Use | any `/v1/*` | Section 5.2 checks | — |
| Refresh | `POST /v1/auth/token` `{ refreshToken }` | Valid and unused → rotate. **Already used → reuse detected: revoke the whole session (every token in the family)**, answer 401. Expired or revoked → 401. | `auth.token.refreshed` (sampled), `auth.token.reuse_detected` |
| Sign out | `DELETE /v1/auth/sessions/current` | Revoke the session and all its tokens | `auth.logout` |
| Password change | `POST /v1/auth/password` | Current password required; every **other** session of the user revoked | `auth.password.changed` |
| Forced change | — | After an HR- or admin-set password, every route except `GET /v1/auth/me`, password change and sign-out answers `403 PASSWORD_CHANGE_REQUIRED` | — |
| Account disabled, exited, or role removed | (admin action) | Disable revokes every session at once; role changes apply on the next request because permissions are read fresh | `user.status_changed`, `user_role.revoked` |
| Password reset (code) | section 5.4 | Every session of the user revoked; sign-in lockouts cleared | `auth.password.reset` |
| My Devices (R2) | `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/:id` | Signed-in user only, **own sessions only** (no permission needed; another user's session ID answers 404). Lists device label, platform, app version, created and last-used time and approximate sign-in IP, with the current session marked. Revoking ends that session and all its tokens at once; revoking the current one is a sign-out. Tokens and hashes are never returned. | `auth.session.revoked` (actor, session ID, reason `user_revoked`) |

**Refresh races on the phone.** Two requests failing with 401 at once must not both refresh, or
the second would look like reuse and sign the user out. The app runs **one refresh at a time**
(single-flight): other requests wait for it and retry once with the new access token. This is a
client rule with its own test (test strategy §6).

**Lockout and rate limits** (the reference's rules): 5 wrong passwords from one IP within 15 minutes
lock that account for that IP only, so a stranger can't lock out the real user; 10 failed sign-ins
per IP per 15 minutes; successful sign-in or any password reset clears the account's locks. In
development the limits can be relaxed by configuration, never in production.

### 5.4 Forgot password: one-time code

| Step | Endpoint | Rule |
|---|---|---|
| Request | `POST /v1/auth/password/forgot` `{ identifier }` (username or work email) | Always `202` with the same body and similar timing, whether or not the account exists. If it exists, is active and has a work email: invalidate earlier codes and email a new **8-digit** code (`crypto.randomInt`). Rate limits (defaults, configurable, section 5.6): **3 requests per account identifier per hour** and **10 requests per source IP per hour**; over the limit still answers `202` and sends nothing. |
| Code storage | `password_reset_codes` | Only `HMAC-SHA256(RESET_CODE_PEPPER, user_id ‖ code)` is stored: a short code needs a secret key, or a database leak would let someone try all 10⁸ codes offline. Expires after **15 minutes** (configurable), single use. |
| Verify and reset | `POST /v1/auth/password/reset` `{ identifier, code, newPassword }` | Constant-time compare. **At most 5 verification attempts per code** (configurable); the 5th wrong one invalidates it. Any failure (unknown account, wrong, used, expired or invalidated code, rate limit) answers the same `400 INVALID_RESET_CODE`. Success: new password (policy checked), code marked used, every session revoked, lockouts cleared. |
| Email | SMTP (Mailpit locally) | Contains the code and its expiry only; never the username in the subject, never a link. |
| Audit | `audit_logs` | `auth.password_reset.requested` (known accounts only; unknown identifiers are counted, never stored), `auth.password_reset.code_failed`, `auth.password_reset.code_invalidated`, `auth.password_reset.completed`, `auth.password_reset.rate_limited`. Rows hold the user ID, IP and request ID, **never the code, a token or the new password**. |

Staff with no work email on file ask HR or an administrator for a temporary password, as in the
reference.

### 5.5 On the phone

- Access token: in memory only (a module-level variable in the session manager), never persisted.
- Refresh token: `expo-secure-store` with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so it
  isn't in backups and doesn't move to another device.
- App start: if a refresh token exists, refresh, then `GET /v1/auth/me`; otherwise show sign-in.
- Sign-out (or a 401 after a failed refresh): delete the refresh token, clear the in-memory token,
  clear the TanStack Query cache, and return to sign-in.
- Returning from the background after the idle limit: the next request fails and the user signs in
  again; the screen content is hidden until then.
- The development role preview (exists today, `src/features/dev/`) builds a local demo session that
  never has a token and never calls the API. It is for design review only, is removed from
  production builds, and is **retired in phase 1.2**: from then on, development builds sign in to
  seeded synthetic accounts through the real API like everyone else (section 6).

### 5.6 Configurable security limits

These are **security settings** in `hospital_settings` (owned by `security_settings:manage`, so only
a Super Admin changes them). Every change needs a reason and writes `settings.changed` with old and
new values. The API validates each value against its allowed range and refuses anything outside it
(`422`), so a limit can't be switched off by mistake. Values are re-read at most every 60 seconds.

| Setting key | Default | Allowed range | Applies to |
|---|---|---|---|
| `access_token_minutes` | 15 | 5–15 | Access-token lifetime |
| `session_idle_minutes` | 30 | 5–60 | Idle session limit |
| `session_absolute_hours` | 12 | 1–12 | Absolute session limit |
| `login_lockout_failures` | 5 | 3–10 | Wrong passwords per account per IP before lockout |
| `login_lockout_minutes` | 15 | 5–60 | Lockout length |
| `password_reset_code_minutes` | 15 | 5–15 | Code validity |
| `password_reset_max_requests_per_account_hour` | 3 | 1–3 | Issuance per account identifier |
| `password_reset_max_requests_per_ip_hour` | 10 | 1–10 | Issuance per source IP |
| `password_reset_max_attempts_per_code` | 5 | 1–5 | Verification attempts before the code is invalidated |

The code length (8 digits), the keyed hash and the generic responses are **not** configurable. The
upper bounds keep every limit at or below the approved values; raising a bound needs a code change
and owner approval. Every limit is tested at its boundary (for example the 3rd request in an hour
sends a code and the 4th doesn't; the 5th wrong attempt invalidates the code; a code is accepted
just before 15 minutes and refused just after) and at a changed value (MA-12, MA-13).

## 6. Data ownership and integration

### 6.1 Who owns which data

| Data | Owner and source of truth | How the app gets it |
|---|---|---|
| Staff accounts, roles, role grants | Database (`users`, `roles`, `user_roles`, `role_permissions`), seeded from `packages/shared` | `GET /v1/auth/me` returns the signed-in user and their permissions |
| Permission catalogue (the 88 codes) | `packages/shared` (code), mirrored into the `permissions` table by the seed; a test fails if they differ | Compiled into both apps; the app uses it only to decide what to show |
| Departments, locations, doctors, schedules, fees, settings | Database, synthetic seed until R2 screens exist | API read endpoints |
| Medicine catalogue, batches, stock, lab tests, service prices | Database, synthetic seed until R3/R4 screens exist | API read endpoints |
| Patients, appointments, encounters, prescriptions, dispensings, lab orders, invoices, payments, corrections | Database, created through the API | API |
| Dashboard figures | Database queries (DB-1) | API report endpoints |
| UI copy, onboarding text, design tokens, role display names | App code | Bundled |

**Rules.**

- No integrated workflow reads a hard-coded app array. Data used by a workflow is a database record
  served by the API, whether it was seeded or entered on a screen.
- The seed writes through the same service layer rules as the API (or SQL that the database
  constraints check), so seeded records are valid records, not shortcuts.
- Seeds are synthetic, repeatable and separate per environment; the production database is never
  seeded with demo patients.
- **Development demo content** is allowed only for design and visual testing: the role preview
  (retired in phase 1.2) and the synthetic dashboard in `src/features/dev/demo-dashboard.ts`
  (aggregate outpatient figures and generic task titles, no patient, appointment, clinical or
  financial records). It is shown only for a demo session in a development build, always under a
  DEMO DATA label, reached only through `src/features/dashboard/dashboard-content.ts` (ESLint), and
  never used as workflow data. Server-issued sessions always get figures from the API.
- The component showcase may keep sample text because it is not a workflow.

### 6.2 API integration contract

| Concern | Rule |
|---|---|
| Base path and versioning | `/v1`. Breaking changes need `/v2`; additive changes don't. |
| App-version check (R1, phase 1.2) | The app sends `X-App-Version` and `X-App-Platform` on every request. `GET /v1/app/version-policy` (public) returns the minimum and latest version per platform, from system settings `app_min_version_android`, `app_min_version_ios`, `app_latest_version_android`, `app_latest_version_ios` (`system_settings:manage`, SA; changes audited as `settings.changed`). Below the minimum, every route except health, the version policy and sign-out answers `426 APP_UPDATE_REQUIRED` and the app shows a blocking update screen; below the latest, a dismissible banner. A missing or malformed version header is treated as below the minimum once enforcement is switched on. Tests AV-1 to AV-4. |
| Schemas | Every request and response body has a Zod schema in `packages/shared`. The API validates input with it; the app parses responses with it and treats a mismatch as an error. |
| Authentication | `Authorization: Bearer <access token>` on every route except sign-in, refresh, forgot and reset. Cookies are ignored. |
| Errors | `{ "error": { "code", "message", "requestId", "fields"? } }`. Stable `code` values (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `CONFLICT`, `STALE_VERSION`, `PASSWORD_CHANGE_REQUIRED`, `PAYMENT_EXCEEDS_BALANCE`, `PRESCRIPTION_EXPIRED`, `CORRECTION_PENDING`, `APP_UPDATE_REQUIRED`, `RATE_LIMITED`, …) listed in `packages/shared`. 403 and 404 never say why. |
| Pagination | Cursor based (`?cursor=&limit=`, limit ≤ 50); patient search capped at 20 rows. |
| Concurrency | `version` in responses and in update bodies; mismatch → `409 STALE_VERSION`. |
| Idempotency | `Idempotency-Key` (UUID) required on booking, check-in, dispensing, payments, and later credit notes, correction decisions and refunds. |
| Live updates (R7) | `GET /v1/events` as Server-Sent Events with the bearer token (section 9). Sending messages and every business action stay REST. |
| Time | ISO 8601 UTC timestamps in JSON; dates as `YYYY-MM-DD` in the hospital time zone; "today" from the server. |
| Money | Integer paise in JSON (`amountPaise`); the app formats rupees. |
| Minimum necessary | Each endpoint returns only the fields its role and screen need (data tiers in the matrix document). |
| Documentation | OpenAPI generated from the shared Zod schemas and published with the API (phase 1.1). |

### 6.3 Seeds and account provisioning (MD-20)

| Data | Development and test databases | Any other environment (pilot, production) |
|---|---|---|
| 11 roles, 88 permissions, role grants | Seeded from `packages/shared` | Seeded the same way (reference data, not demo data) |
| Hospital reference data (departments, doctors, schedules, catalogues, prices) | Synthetic seed | Synthetic seed for a pilot; entered through management screens later |
| First Super Admin | Bootstrap command or demo seed | **Bootstrap command only** |
| Other staff accounts | Demo accounts, one or more per role | **Authorized administration only**: HR `user:create` creates the login, SA `user_role:assign` grants roles, from R1 (MD-23); never seeded |
| Synthetic patients and visits | Optional demo seed | Never |

**Bootstrap (`npm run api:bootstrap-admin`, phase 1.2).** Interactive, run on the server by an
operator with the `hos_owner` credentials; refuses to run while any active Super Admin exists;
asks for username, display name, work email and a password typed twice (never an argument or an
environment variable, never echoed, policy checked); creates the employee, user and SA role grant
in one transaction; writes `user.bootstrap_created` with `actor_type = system` and the operator's
OS user name; prints no secret. The account must choose a new password at first sign-in only if the
operator asks for that.

**Operator password reset (`npm run api:reset-password`, phase 1.2).** Same operator rules, for any
account; ends every session and clears lockouts; audited `user.password_reset` with
`actor_type = system`. It covers staff without a work email until in-app resets exist.

**Minimal account administration (R1, phase 1.2b, MD-23).**

| Action | Endpoint | Who | Rules | Audit |
|---|---|---|---|---|
| Add staff member and login | `POST /v1/admin/staff` | `user:create` (HR, SA) | Name, employee number, department, designation, username, optional work email, **temporary password typed by HR** (policy checked, never a default); the account has no roles; first sign-in forces a new password (`PASSWORD_CHANGE_REQUIRED`) | `user.created` |
| Grant or revoke a role | `POST /v1/admin/users/:id/roles/grant`, `…/revoke` | `user_role:assign` (SA only) | Reason required; never on one's own account; the last active SA can't lose the role (shared lock); takes effect on the user's next request | `user_role.granted`, `user_role.revoked` |
| Disable or re-enable | `POST /v1/admin/users/:id/status` | `user:manage` (ADM, SA) | Reason required; never one's own account; ADM can't change SA accounts; disabling revokes every session at once; last active SA protected | `user.status_changed` |

Screens: HR "Add staff member"; SA "Staff access" (roles); ADM/SA "Disable account". Password
resets by an administrator, work-email changes and role definitions stay in R2.

**Demo accounts (development and test only).**

- The demo seed refuses to run unless `NODE_ENV` is `development` or `test` **and** the database is
  `hospitalos_dev` or `hospitalos_test` (ACC-4).
- Each run generates a **new random password per account** (`crypto.randomBytes`), stores only its
  argon2id hash, and prints the credentials once to the operator's terminal. Nothing is written to
  the repository, to `.env` files or to the app. Re-running the seed replaces them (disposable).
- Demo usernames carry a `demo-` prefix and the accounts are flagged `is_demo`; the API refuses to
  start in production while any `is_demo` account exists (ACC-5).
- Automated tests create their own accounts in `hospitalos_test` and never use the development
  credentials.
- The app never contains credentials. Development builds sign in to demo accounts through the
  normal sign-in screen.

## 7. Environments and local isolation

The reference project and this one must be able to run on the same laptop without either touching
the other's data. Every name and port below was compared with the reference's
`docker-compose.yml`, `.env.example`, README and API defaults on 2026-11-05.

| Resource | Reference (`hospital-management-system`) | This product (`hospitalos-App`) |
|---|---|---|
| Compose project name | `hospitalos` | `hospitalos-mobile` (set explicitly with `name:`) |
| Compose network | `hospitalos_default` | `hospitalos-mobile_default` |
| PostgreSQL volume | `hospitalos_hms_pgdata` | `hospitalos-mobile_pgdata` |
| PostgreSQL host port | `127.0.0.1:5432` | `127.0.0.1:5433` |
| Databases | `hms_dev`, `hms_test` | `hospitalos_dev`, `hospitalos_test` |
| Database users | `hms_owner`, `hms_app` (+ Docker superuser from its `.env`) | `hos_owner`, `hos_app` (+ our own Docker superuser) |
| API port | 3000 | 4000 |
| Web or app dev server | Vite 5173 | Expo Metro 8081 |
| Mailpit SMTP / inbox | 1025 / 8025 | 1026 / 8026 |
| LiveKit (R8) | 7880, 7881, 7882/udp | 7890, 7891, 7892/udp |
| Environment file | repository-root `.env` | `apps/api/.env` and `apps/mobile/.env`, separately git-ignored |
| Secrets | its own | generated fresh for this project (`openssl rand -hex 32`); never copied |

**Checked on 2026-11-05:** ports 4000, 5433, 1026, 8026 and 7890 were free on this machine; 8081 was
in use by a `node` process (most likely this project's Metro dev server; the reference doesn't use
8081). 7891 and 7892/udp are checked in R8. Docker was not running, so existing volume and network
names couldn't be listed; phase 1.1 repeats the check with `docker volume ls` and
`docker network ls` before the first `docker compose up`.

**Rechecked on 2026-11-05 (final review):** the ports above were still free (8081 still the local
`node` process); Docker was still not running (no daemon socket). **The live check of volumes,
networks and Compose projects is a mandatory first step of phase 1.1, before any database is
created** (ISO-0).

**Environment files.** `apps/mobile/.env` is git-ignored by `apps/mobile/.gitignore` (verified).
The repository has **no root `.gitignore` yet**, so a future `apps/api/.env` would not be ignored.
Phase 1.1 adds ignore rules for `apps/api/.env` (and `.env.*` except `.env.example`) **before**
that file is created, and ISO-4 tests it.

**Guards in code (phase 1.1):**

- The API refuses to start unless `current_database()` is one of `hospitalos_dev`,
  `hospitalos_test` or the configured production name, and `current_user` is `hos_app`, so a wrong
  connection string can never reach an `hms_*` database.
- Migrations and seeds run the same check with `hos_owner` and refuse anything else.
- Compose binds every port to `127.0.0.1` only.

| Item | Value |
|---|---|
| Emulator to API | `adb reverse tcp:4000 tcp:4000`, so the app calls `http://127.0.0.1:4000` and the API stays bound to localhost |
| Physical phone | USB with `adb reverse` (preferred), or the API bound to the laptop's LAN address with `EXPO_PUBLIC_API_URL=http://<lan-ip>:4000`, documented step by step. Cleartext HTTP is allowed only in development builds. |
| Configuration | API: Zod-validated `apps/api/.env` (git-ignored, `chmod 600`) with `.env.example` placeholders; secrets also accepted as `NAME_FILE`. Mobile: `EXPO_PUBLIC_*` values are public by definition and never hold secrets. |
| Production | TLS everywhere; managed PostgreSQL with verified TLS; host chosen in R9. |

## 8. Mobile client

| Concern | Choice |
|---|---|
| Navigation | Expo Router; protected route groups; five tabs (MD-6); modules open from Home |
| Server data | TanStack Query, in memory only in R1 (no persisted cache). Query keys per module; mutations invalidate the affected lists. |
| API client | Typed `fetch` wrapper using the shared Zod schemas: timeout (15 s), `requestId` surfaced in errors, structured error mapping, retries only for safe reads and for writes that carry an `Idempotency-Key` |
| Forms | React Hook Form + Zod resolver with the shared schemas (needs approval to install) |
| Design | The existing design system (`docs/DESIGN-SYSTEM.md`); no design values in screens |
| Inbox before R7 | The tab exists from phase 1.0 with a polished, clearly labelled "Notices, messages, call requests and meetings arrive in Release 7" state. No sample or invented items. |
| Documents (R1) | Receipts, invoices and verified lab reports are **viewed inside the app only**, rendered from API data on a normal permission-checked screen; nothing is written to phone storage and there is no export or share action (MD-15). PDF export and sharing come later, after their design is approved (section 12.2, M-ADR-7). |
| Camera | `expo-camera` for lab sample barcodes (R1, approval to install); camera permission asked only when scanning |
| Logging | No patient data, tokens or codes in console or crash logs; a redaction helper and a lint rule |
| Expo Go | Release 1 stays Expo Go compatible. Push notifications on Android (R7) and LiveKit video (R8) need an **Expo development build**. |

## 9. Live updates and push (Release 7)

- **Model (MD-18):** the reference's model is kept. REST for sending messages and every business
  operation; **Server-Sent Events** for server-to-client live updates; no WebSocket layer unless a
  documented requirement shows REST and SSE are insufficient.
- **While the app is open:** one authenticated SSE stream, `GET /v1/events`, sent with
  `Authorization: Bearer <access token>` (not a cookie). The browser `EventSource` API can't send
  that header, so the app reads the stream with Expo's streaming `fetch` (`expo/fetch`, part of the
  installed `expo` package); a short spike at the start of R7 confirms it on Android and iOS before
  any SSE library is considered. Events carry only a type and record IDs; the app reloads the data
  through the normal permission-checked endpoints. Reconnects use `Last-Event-ID`. The stream closes
  when the app goes to the background, when the access token expires (the app reconnects with the
  new one), and at once when the session is revoked.
- **Several API processes:** events travel between processes by PostgreSQL `LISTEN`/`NOTIFY`, as in
  the reference's shared-state mode.
- **While closed:** push via Expo push service / Firebase Cloud Messaging (Android) and APNs (iOS).
  Devices register in `push_devices` after sign-in and are removed at sign-out or session
  revocation. **User preferences** (`push_preferences`): each person turns categories on or off
  (notices, messages, call requests, meeting invitations); whether emergency-meeting alerts may be
  turned off is decided in R7 planning. **Notification text never contains patient names, MRNs or clinical content**, only
  "New message from Dr. A" or "Emergency meeting started"; tapping opens the app, which checks the
  session and permission before showing anything. Lock-screen visibility is set to hide content on
  Android (`VISIBILITY_PRIVATE`) and iOS (content hidden until unlocked).
- **Offline:** read-only cached lists marked with their last sync time; no offline writes.

## 10. Video meetings (Release 8)

- LiveKit server (self-hosted, pinned version, ports in section 7) with `@livekit/react-native` and its WebRTC module,
  in an Expo development build.
- The API issues a LiveKit pass only after its own join checks: one room, valid 5 minutes, audio
  and video publish only, no data channel, no room-admin rights. The LiveKit secret never leaves the
  server.
- A TURN relay is required, because phones on mobile data usually can't connect directly.
- Emergency meetings ring full-screen while the app is open. Ringing a locked phone needs the native
  call screen (Android ConnectionService, iOS CallKit with VoIP push), planned as a later step of R8.

## 11. Security baseline

- Helmet headers, strict JSON body limits, Zod validation on every input, generic 401/403/404.
- Every permission and record rule tested per role (test strategy §5).
- Secret scanning in CI; no secrets in Git; `.env` git-ignored; signing keys outside the repository.
- `npm audit --audit-level=high` in CI for both apps.
- No patient data in logs, crash reports, analytics, push text or phone storage.
- The audit log can't be edited or deleted by anyone through the application.

## 12. Architecture decision summary

### 12.1 Owner-approved decisions (2026-11-05)

| # | Decision |
|---|---|
| 1 | **Backend:** Express 5, Node.js 24, TypeScript, PostgreSQL 17, Drizzle ORM, Zod, inside `hospitalos-App` (`apps/api`). Entirely independent: never connects to, reuses, modifies or migrates the reference's backend or database. |
| 2 | **Releases:** R1 integrated outpatient journey · R2 administration and governance · R3 finance and billing corrections · R4 pharmacy stock and inventory · R5 HR · R6 outreach and analytics · R7 messaging and notices · R8 video meetings · R9 production hardening and release. All 11 roles and 88 permissions kept. |
| 3 | **Nurses:** assignment management in R1; nurses act only within their role and assignment; no nursing notes or care tasks. |
| 4 | **Billing:** no automatic credit notes. Draft invoices are recalculated when a service is cancelled; issued invoices are never changed silently; corrections go through the Finance workflow (R3); every correction audited. |
| 5 | **Data:** synthetic seed data in the independent PostgreSQL database, served by the API. No hard-coded app arrays as a source of truth for integrated workflows. |
| 6 | **Authentication:** opaque random tokens; access 15 min in memory; rotating refresh token hashed on the server, held in SecureStore; reuse detection revokes the token family; 30-min idle and 12-h absolute session limits; logout and account-disable revocation. |
| 7 | **Forgot password (D4):** 8-digit cryptographically random emailed code, 15 minutes, at most 5 attempts per code, at most 3 requests per account and 10 per source IP per hour, keyed hash only, configurable within those bounds with boundary tests, generic responses, audited without codes or tokens. |
| 8 | **Local isolation:** own databases, database users and privileges, Compose project, network and volumes, API port 4000, PostgreSQL host port 5433, own environment files and secrets (section 7). |
| 9 | **Outside feature parity:** inpatient care, insurance, imaging, SMS, payroll, nursing notes and care tasks are potential future enhancements needing separate approval. |
| 10 | **Navigation:** Home, Work Queue, Search, Inbox, Profile; Inbox shows a labelled "coming in Release 7" state until then, never invented content. |
| 11 | **Credit notes (D1):** FIN and SA keep `credit_note:create` (88-permission matrix unchanged); both use the controlled Finance workflow; nobody creates, resolves or rejects a correction from their own cancellation. |
| 12 | **Documents (D2):** R1 views receipts and reports in the app only; PDF export, share sheet and sharing deferred until designed and approved. |
| 13 | **Correction safeguards (D3):** payments never exceed the valid outstanding balance; pending cancelled amounts can't be collected; same approach for R4 returns; rejection only with a mandatory reason, as an immutable audit event that can't erase an issued invoice, credit note or refund due; all transitions transactional and tested. |
| 14 | **Real time (D5):** REST + Server-Sent Events as in the reference; push in R7 with preferences and privacy-safe lock-screen text; LiveKit in R8; no WebSocket without a documented need. |
| 15 | **Additions (D6):** My Devices (R2), app-version check with minimum-version enforcement (R1), document-sharing audit (with document sharing). |
| 16 | **Seeds and accounts (MD-20):** roles and 88 permissions seeded everywhere; no default or shared passwords anywhere; first SA by audited bootstrap; other accounts by authorized administration; demo accounts only in development and test, with disposable credentials (section 6.3). |
| 17 | **End-of-day job (MD-21):** an addition beyond the built reference, delivered in R2 with reconciliation, idempotency, recovery and audit (workflows §6); not on the R1 critical path. |
| 18 | **Release 1 billing (MD-22):** draft invoices, consultation/pharmacy/lab charges, payments, in-app receipts, pending corrections; complete credit-note, approval, rejection and refund workflows in R3. |
| 19 | **Minimal account administration in R1 (MD-23):** HR creates logins with a forced first password change, SA assigns and revokes roles, ADM/SA disable accounts; reasons and audit on every change (section 6.3). |

### 12.2 Deliberate differences from the reference

Each becomes an ADR in `docs/adr/` when its phase starts. "Approval" says whether the owner has
already approved the difference or still needs to.

| # | Difference | Rationale | Impact | Security implications | Approval |
|---|---|---|---|---|---|
| M-ADR-1 | Opaque access token (15 min, memory) + rotating refresh token (SecureStore) instead of an `httpOnly` cookie session with CSRF token | A native app has no browser cookie jar and sends credentials itself (section 5.1) | New tables (`auth_sessions`, `auth_tokens`); single-flight refresh in the app; no CSRF code; SE-3 (CSRF) replaced by MA-1 to MA-14 | No ambient credential, so no CSRF; instant revocation kept because tokens are looked up on every request; refresh-token reuse revokes the whole family; a stolen phone is limited by device-only Keychain/Keystore storage and the idle and absolute limits | **Approved** 2026-11-05 |
| M-ADR-2 | Emailed 8-digit one-time code instead of an emailed reset link | No web page to open a link; the code is typed into the same app | `password_reset_codes` table; reset screens in the app | Short code needs a keyed hash (HMAC with a secret pepper), 15-minute life, 5 attempts per code and per-account and per-IP limits (section 5.6); generic responses keep account existence secret | **Approved** 2026-11-05 (D4) |
| M-ADR-3 | Server-Sent Events kept, but authenticated with the bearer token and read with Expo's streaming `fetch` instead of a cookie and the browser's `EventSource` | Same model as the reference (D5); a phone has no cookie and `EventSource` can't send an `Authorization` header | No new transport and no WebSocket layer; a small streaming reader in the app; an R7 spike confirms `expo/fetch` streaming on both platforms | The stream is authorised like any request and closed at once on session revocation; events carry only types and IDs, so a leaked event reveals nothing; connection rate limits | **Approved** 2026-11-05 (D5) |
| M-ADR-4 | Push notifications with privacy-safe text (reference has browser desktop alerts only) | Staff are often away from the screen; call requests and emergency meetings need to reach them | `push_devices` table; Expo push service, Firebase Cloud Messaging and APNs; an Expo development build | **Notification content passes through Expo, Google and Apple servers**, so text is limited to non-identifying wording (no names, MRNs or clinical terms; tested); device tokens removed at sign-out and revocation; opening a notification re-checks session and permission | **Approved** 2026-11-05 for R7 (D5), with user preferences and privacy-safe lock-screen text |
| M-ADR-5 | LiveKit media server only, no direct peer-to-peer fallback (reference falls back to browser-to-browser calls of up to 8) | Phones on mobile networks rarely connect peer to peer; one code path to test | LiveKit server and a TURN relay are required for any video; a development build | The API issues a 5-minute single-room pass after its own checks; the LiveKit secret stays on the server; media goes through our server, so it must run on infrastructure we control; no recording | **Approved** 2026-11-05 for R8 (D5) |
| M-ADR-6 | Own database names, users, Compose project, network, volumes, ports and environment files | Independence from the reference on the same machine (section 7) | Different defaults from the reference's documentation; start-up guards | Prevents a wrong connection string from ever reading or changing the reference's `hms_*` data; secrets generated fresh | **Approved** 2026-11-05 |
| M-ADR-7 | Receipts, invoices and lab reports are **viewed in the app only** in R1; the reference's browser printing has no R1 equivalent. PDF export and sharing are deferred | Exported files carry patient data out of the app; their authorization, privacy and audit must be designed first (D2) | No `expo-print` or `expo-sharing` in R1; no files on the phone; the export feature is designed in R2 and built no earlier than R3 after approval | Nothing leaves the app in R1. When sharing arrives, every share is audited in `document_shares` (actor, document type and ID, time, outcome, never contents) and files are temporary | **Approved** 2026-11-05 (D2); the later export design needs its own approval |
| M-ADR-8 | Billing corrections resolved by Finance instead of automatic credit notes | Owner decision MD-11 | New `billing_corrections` table; payment cap while a correction is open; no credit notes until R3; the reference's BL-6 and BL-11 amended | An issued invoice is never rewritten; every correction is an append-only, audited record; only `credit_note:create` holders (FIN, SA) resolve or reject it, never the person who cancelled; payments never exceed the valid outstanding balance; rejection needs a reason and can't erase an invoice, credit note or refund due | **Approved** 2026-11-05 (D1, D3) |
