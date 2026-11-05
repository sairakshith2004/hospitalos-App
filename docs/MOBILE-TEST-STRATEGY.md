# HospitalOS Mobile: test strategy

Status: **final draft for owner review**, 2026-11-05 (all owner decisions of 2026-11-05 applied,
including D1 to D6 and the Release 1 corrections MD-20 to MD-23).

## 1. Principles

- Tests prove both halves of every rule: the right role can, every other role can't.
- Rules are tested where they are enforced: the API and the database. Mobile tests prove the app
  shows the right state and sends the right request; they never stand in for server tests.
- Database tests run against a real PostgreSQL 17 (`hospitalos_test`), never mocks, because the
  constraints, triggers and locks are part of the rules.
- Synthetic data only. Fixtures are generated, never copied from anywhere.
- Acceptance criteria keep the reference's IDs (PR-1, BK-2, …). New criteria: MA-* (sessions),
  MB-* (billing corrections), DO-* (data ownership), ISO-* (local isolation), AV-* (app version),
  DX-* (document sharing, when introduced), RT-* (live updates and push), ACC-* (accounts and
  bootstrap), JB-7 to JB-10 (end-of-day additions), F0-* (Phase 1.0, F0-1 to F0-7).
- Tests read their data from a seeded test database through the API; no test asserts against
  app-side fixture arrays standing in for workflow data.
- A result is reported only after the test actually ran. Device checks name the device.

## 2. Layers and tools

| Layer | Tool | Runs | What it covers |
|---|---|---|---|
| Shared rules | Vitest | Every commit | Permission map, role grants (against the generated table in the matrix document), Zod schemas, money and time helpers |
| API unit | Vitest | Every commit | Services with pure logic: availability, FEFO selection, equivalence, discount allocation, GST rounding, token helpers |
| API integration | Vitest + supertest | Every commit | Every endpoint through HTTP: validation, permission, record rule, audit row, error envelope |
| Database | Vitest on `hospitalos_test` | Every commit | Constraints, triggers (append-only, no self-approval, no negative stock), grants of `hos_app`, migrations from empty and from the previous version |
| Concurrency | Vitest, parallel connections | Every commit | BK-2, DP-2, DP-4, DP-7, DP-9, ST-12, last-SA race, refresh-token race, day-close concurrency |
| Mobile unit and component | Jest (`jest-expo`) + React Native Testing Library | Every commit | Components, hooks, session manager, API client error mapping, form validation |
| Mobile flow | `expo-router/testing-library` with a mocked API at the `fetch` boundary | Every commit | Navigation, permission-aware screens, loading/empty/error/offline/denied states, forms |
| Contract | Shared Zod schemas | Every commit | The API's responses parse with the same schema the app uses; a test fails if they drift |
| End-to-end (mobile + API) | Maestro on an Android emulator against a seeded API | Each phase gate and nightly in CI later | The workflows in [workflows §2](MOBILE-WORKFLOWS.md#2-the-outpatient-patient-journey) |
| Device | Manual checklist (section 8) | Each release gate | Physical Android phone, emulator sizes, iOS before an iOS release |

**Known limit (2026-11-05):** the `jest-expo/android` platform preset fails to load in Expo SDK 57
(a React Native setup file isn't transformed), so mobile Jest tests run on the default preset.
Platform-specific code paths are unit-tested by mocking `Platform.OS`; Android behaviour (tab roles,
back button, keyboard, SecureStore) is proven on the emulator and in end-to-end runs. The preset is
re-checked at every Expo SDK update (roadmap U6).

## 3. Test data

- A seed builder writes the hospital **into the PostgreSQL test database**: the 11 roles with the 88
  permissions, staff accounts for every role (plus a second LAB and FIN for maker-checker tests),
  departments, doctors with schedules, medicines with batches at chosen expiry dates, lab tests,
  prices. The development seed uses the same builder against `hospitalos_dev`.
- Mobile flow tests mock the API at the `fetch` boundary with responses that parse against the
  shared schemas; end-to-end tests use the real API and seeded database.
- Each database test runs in its own transaction or freshly truncated tables; concurrency tests use
  separate connections and clean up afterwards.
- Times are controlled through an injectable clock in the API (Asia/Kolkata), so "today", expiry and
  end-of-day tests don't depend on when they run.
- Fixture names are obviously fake ("Test Patient 014", `MRN900014`).

## 4. Coverage by area

| Area | Must prove | Criteria |
|---|---|---|
| Patients | MRN unique, duplicate warning, field errors, audit field names, 20-row cap | PR-1 to PR-4 |
| Scheduling | Availability exclusions, one winner of 10 parallel bookings, reschedule atomic, freed slot reusable | SC-1, SC-2, BK-1 to BK-5 |
| Queue and check-in | Sequential tokens, walk-ins, fee once, vitals before encounter | QU-1 to QU-4, CF-1 to CF-5 |
| Clinical access | Care windows, nurse assignment, emergency access, audit fail-closed, 404 for hidden records | AX-1 to AX-13, L12 |
| Consultation | Edits while in progress audited, completed immutable (trigger), entered in error | CN-1 to CN-3 |
| Prescribing and dispensing | Allergy acknowledgement, availability search, stock conservation, idempotency, expiry, substitution | RX-1 to RX-4, DP-1 to DP-11, EX-1 to EX-5, SB-1 to SB-5 |
| Stock | Location-kind permissions, reasons, no negatives, transfers | ST-1 to ST-12 |
| Lab | Flow, verifier ≠ enterer, flags, report viewable in the app only after verification, amendments | LB-1 to LB-5 |
| Billing (R1) | Totals at commit, partial payments, duplicate payments, cancelled services never charged, issued invoices never changed, no credit notes in R1, no deletes | BL-1 to BL-4, BL-8 to BL-10, MB-1 to MB-5 |
| Billing corrections (R3, R4) | Finance resolution and rejection, separation of duties, returns, voids, credit notes, refunds, discounts, transactional rollback | MB-6 to MB-9, BL-5 to BL-7, BL-11 (amended), BL-12, DS-1 to DS-6 |
| Follow-ups (R1) | Transitions, overdue computed when read | FU-1 to FU-4 |
| End-of-day job (R2) | Transitions, idempotent reruns, manual trigger permission, on/off switch, catch-up, crash recovery, reconciliation, integrity alerts | JB-1 to JB-10 |
| Time-based states without the job (R1) | Past `booked` shown as did-not-arrive and not check-in-able; expired prescription refused at dispensing (`PRESCRIPTION_EXPIRED`) | BK-*, DP-* additions |
| Administration | Account and role rules, last SA, settings by key, audit viewer limits | AD-1 to AD-8 |
| Dashboards | Exact values from seeded data | DB-1 |

## 5. Authorization tests

- **Role × endpoint table (SE-1).** One table lists every endpoint with the permission it needs. A
  generated test calls each endpoint as each of the 11 roles (plus "no roles" and "signed out") and
  expects 2xx or the documented 403/404/401. Adding an endpoint without a row fails the build.
- **Direct object references.** For every endpoint with an ID: another doctor's encounter, a
  patient outside the care window, a conversation the user isn't in, an unassigned nurse's patient.
  Expected: the same 404 as an unknown ID, and an `access.denied` audit row.
- **Client-supplied identity is ignored.** Requests that put `userId`, `role`, `doctorId` or
  permissions in the body or query don't change who acts.
- **Self-approval.** Every maker-checker action tried by its maker, in the service and directly
  against the database.
- **Data minimisation.** Responses checked field by field for roles with limited views (pharmacy
  allergies, lab order details, HR discount list, MKT aggregates, SA audit viewer).

## 6. Session lifecycle tests (MA-*)

| ID | Test |
|---|---|
| MA-1 | Sign-in with right credentials returns an access token, a refresh token and the user; the database holds only their hashes. |
| MA-2 | Wrong password, unknown user and disabled user all return the same `401 INVALID_CREDENTIALS` with similar timing. |
| MA-3 | Requests without a token, with a malformed token or with an expired access token get 401 (SE-2). |
| MA-4 | Refresh returns a new pair; the old refresh token is marked used. |
| MA-5 | **Reuse detection:** presenting a used refresh token revokes the whole session; its newest access and refresh tokens stop working immediately; `auth.token.reuse_detected` is audited. |
| MA-6 | Idle limit: no request for longer than `session_idle_minutes` → refresh and access fail. Absolute limit: after `session_absolute_hours`, refresh fails even with constant activity. Both tested with the injected clock. |
| MA-7 | Sign-out revokes the session; its tokens fail on the next request. |
| MA-8 | Disabling the account, marking the employee exited, or revoking the last role: the next request with an existing token is refused or loses those permissions (SE-6, AD-8). |
| MA-9 | Password change ends every other session but keeps the current one. |
| MA-10 | Forced change: every route except `me`, password change and sign-out returns `403 PASSWORD_CHANGE_REQUIRED`. |
| MA-11 | Lockout: 5 failures from one IP lock that account for that IP only; another IP can still sign in; a success or reset clears locks (SE-4). |
| MA-12 | (Defaults from architecture §5.6. **Boundary tests:** 3rd request in an hour sends a code, 4th doesn't; 10th request from one IP is handled, 11th isn't; each limit also tested at a changed value and refused outside its allowed range.) Forgot password always returns 202 with the same body for known, unknown, disabled and email-less accounts; codes are 8 digits and expire after 15 minutes; at most 3 codes per account identifier per hour and 10 requests per source IP per hour (over the limit: still 202, nothing sent); only the keyed hash is stored; a new code invalidates earlier ones. |
| MA-13 | Reset code: wrong, expired, used, invalidated and other-account codes all return the same `400 INVALID_RESET_CODE`; **boundary tests:** the 4th wrong attempt leaves the code usable, the 5th invalidates it; a code is accepted just before 15 minutes and refused just after; codes are 8 digits from a cryptographic generator; success revokes every session and clears lockouts; audit rows exist for each step and contain no code, token or password. |
| MA-14 | Logs captured during MA-1 to MA-13 contain no password, token, code or email address. |
| MA-15 | (R2) My Devices lists only my sessions, with the current one marked and no token or hash in the response; another user's session ID answers 404 on read and revoke. |
| MA-16 | (R2) Revoking one of my sessions ends it and all its tokens on the next request, writes `auth.session.revoked`, and leaves my other sessions working; revoking the current session signs me out. |

## 7. Billing corrections, data ownership and isolation

| ID | Test |
|---|---|
| MB-1 | Cancelling a visit after check-in, or a lab order, whose line is on a **draft** invoice deactivates the line (row kept, reason and actor recorded), recalculates the draft's totals in the same transaction, and audits both. |
| MB-2 | The same cancellation when the invoice is **issued** leaves every invoice and line column unchanged (compared before and after), opens one `billing_corrections` row with origin, amount and reason, and audits it; a second cancellation attempt opens no second row. |
| MB-3 | A payment above the valid outstanding balance (amount due − net paid − open corrections) is refused (`PAYMENT_EXCEEDS_BALANCE`, or `CORRECTION_PENDING` when an open correction is the reason); a payment of exactly the balance succeeds; concurrent payments can't together exceed it. |
| MB-4 | If the cancelled service was already paid, the correction is flagged "may need a refund" and no money moves. |
| MB-5 | FIN, ADM and SA can list open corrections; REC sees them on the invoice; other roles get 403; nobody can edit or delete a correction (service and database). |
| MB-6 | (R3) Only `credit_note:create` holders (FIN and SA) resolve a correction by creating its credit note; the correction closes and links it in one transaction; the person recorded as `initiated_by` gets 403 even as FIN or SA (service and database CHECK); every other role gets 403; every step audited; the invoice status is recalculated from the amounts. |
| MB-7 | (R3) Rejection needs a reason (422 without), is refused to the initiator, writes an immutable `billing_correction.rejected` event, makes the amount collectable again, and leaves every issued invoice, existing credit note and refund due or paid unchanged (compared before and after). A resolved or rejected correction can't change state again (409). |
| MB-8 | (R4) A dispense return against an issued invoice opens a correction with origin `dispense_return`; against a draft it reduces the line and recalculates the draft. |
| MB-9 | Every financial transition (payment, correction open/resolve/reject, credit note, refund) rolls back completely when any step fails, including its audit row (fault-injection test). |
| — | R1 has no route that creates a credit note (role × endpoint table). |
| ACC-1 | The bootstrap refuses to run while an active Super Admin exists; otherwise it creates exactly one SA (employee, user, role grant) in one transaction and writes `user.bootstrap_created`; the password never appears in output, logs, shell history or audit. |
| ACC-2 | The bootstrap and operator reset refuse to run without `hos_owner` credentials or against a non-`hospitalos_*` database. |
| ACC-3 | The demo seed generates a different random password per account on every run, stores only argon2id hashes, and writes no credential to any file in the repository. |
| ACC-4 | The demo seed refuses to run unless `NODE_ENV` is `development` or `test` and the database is `hospitalos_dev` or `hospitalos_test`. |
| ACC-6 | (Phase 1.2b) HR creates a staff login with a temporary password: the account has no roles, every protected route answers 403 until SA grants one, and every route except `me`, password change and sign-out answers `PASSWORD_CHANGE_REQUIRED` until the person chooses a new password; HR gets 403 on role grants. |
| ACC-7 | (Phase 1.2b) Role grant and revoke need `user_role:assign` and a reason; nobody changes their own roles; revoking the last active SA's role and disabling the last active SA both answer 409, also when run concurrently; ADM gets 403 on SA accounts. |
| ACC-8 | (Phase 1.2b) Disabling an account revokes all its sessions on the next request; every account change writes its audit row in the same transaction. |
| ACC-5 | The API refuses to start with `NODE_ENV=production` while any `is_demo` account exists; the roles-and-permissions seed alone creates no user. |
| JB-7 | (R2) After two missed scheduled runs, start-up runs both business dates in order, oldest first. |
| JB-8 | (R2) A run killed after step 1 and rerun gives exactly the same final state and audit rows as one clean run. |
| JB-9 | (R2) Reconciliation figures for a seeded day equal independently computed values (collections = payments − paid refunds, BL-8). |
| JB-10 | (R2) An injected stock or invoice-total mismatch is reported in the run and alerted to ADM and SA, and no data is changed. |
| F0-1 | The app's permission catalogue has exactly 88 unique codes, equal to the grid in the matrix document (the test parses the document). |
| F0-2 | Each role's grants equal the matrix grid; SA holds all 88; the per-role totals are SA 88, ADM 29, REC 21, DOC 19, NUR 11, PHA 19, LAB 8, FIN 17, HR 11, INV 12, MKT 6. |
| F0-3 | Module visibility per role follows the module table (roadmap §3.1); a role without the permission never sees the module. |
| F0-4 | The Inbox tab exists for all 11 roles and shows only the labelled "coming in Release 7" state; the Notifications route no longer exists. |
| F0-5 | A demo session has no credential field and the app contains no code that sends a request to an API in Phase 1.0; a demo session can't be created when `devToolsEnabled` is false, and the role-preview route doesn't exist in production configuration. (From phase 1.2 the API client accepts only server-issued sessions, so a demo session can never authorize an API call.) |
| F0-6 | Existing navigation, sign-out, role-preview and not-found tests still pass with the tab renamed. |
| F0-7 | Dashboard demo data: a demo session in a development build sees synthetic figures and tasks for its role, each block under a DEMO DATA label; a server-issued session and any production build see the empty state and no DEMO DATA; the content is outpatient-only and contains no patient identifiers or clinical details; no invented system status is shown. |
| AV-1 | `GET /v1/app/version-policy` works without signing in and returns the per-platform minimum and latest versions. |
| AV-2 | With enforcement on, a request with a version below the minimum (or a missing or malformed header) gets `426 APP_UPDATE_REQUIRED` on every route except health, version policy and sign-out; a version equal to the minimum passes. |
| AV-3 | Only SA (`system_settings:manage`) changes the version settings; each change is audited. |
| AV-4 | The app shows a blocking update screen on 426 and a dismissible banner below the latest version. |
| DX-1 | (With document sharing) Each export or share writes one `document_shares` row: actor, document type and ID, time, outcome; never the contents. |
| DX-2 | Exporting a document needs the same permission and record access as viewing it; otherwise 404. |
| DX-3 | The temporary file is removed after the share completes or is cancelled. |
| RT-1 | (R7) `GET /v1/events` refuses a missing or revoked token; a revoked session's open stream is closed within one event cycle. |
| RT-2 | (R7) Events contain only a type and record IDs (schema test); every follow-up read goes through a permission-checked endpoint. |
| RT-3 | (R7) Push preferences per category are honoured; lock-screen text never contains patient names, MRNs or clinical terms. |
| DO-1 | Every list the R1 journey uses (doctors, schedules, slots, medicines, batches, lab tests, prices, patients, queues, invoices) is fetched from the API; a test against an empty database shows empty states, not data. |
| DO-2 | Every dashboard figure shown to a server-issued session has an API source (DB-1); development demo figures (F0-7) never reach such a session. |
| DO-3 | ESLint rule: modules outside `src/features/dev` and `src/features/showcase` can't import `demo-data`, `fixtures` or `sample-data` modules, and only `src/features/dashboard/dashboard-content.ts` may import the development demo dashboard. |
| DO-4 | The signed-in user's permissions in the app always equal `GET /v1/auth/me`; a role change on the server shows on the next refresh. |
| ISO-0 | Before the first database is created (phase 1.1), with Docker running: `docker compose ls`, `docker volume ls` and `docker network ls` show no `hospitalos-mobile` resources owned by anything else, and the reference's `hospitalos` project, `hospitalos_hms_pgdata` volume and `hospitalos_default` network are left untouched; ports 4000, 5433, 1026, 8026 free. Result recorded in the phase report. |
| ISO-1 | Compose config renders project `hospitalos-mobile`, volume `hospitalos-mobile-pgdata`, network `hospitalos-mobile-network`, ports 5433, 1026, 8026 bound to `127.0.0.1` only (`docker compose config` check in CI). |
| ISO-2 | The API refuses to start against a database whose name isn't `hospitalos_*` or as a user other than `hos_app` (tested by pointing it at a throwaway database named `hms_dev`). |
| ISO-3 | Migrations and seeds refuse to run unless connected as `hos_owner` to a `hospitalos_*` database. |
| ISO-4 | `git check-ignore` confirms `apps/api/.env` and `apps/mobile/.env` are ignored before either is created or used; `.env.example` files contain placeholders only; the secret scanner passes; no environment file is shared with another project. |

**Mobile client tests for the session manager:** access token never written to storage; refresh
token written only to SecureStore with the device-only option; **two parallel 401s trigger exactly
one refresh** (single-flight) and both requests succeed; a failed refresh clears SecureStore and the
query cache and shows sign-in; sign-out does the same; the password sheet keeps unsent form input
in memory and discards it when a different user signs in.

## 8. Security, privacy and resilience tests

- Log capture on every API test run: no patient fields, tokens, codes, passwords (SE-5).
- Push payload builder (R7): no patient names, MRNs or clinical words in any notification text.
- Inbox before R7: renders only the labelled "coming in Release 7" state; no sample items exist in
  the bundle.
- Mobile storage audit: after a full journey, SecureStore holds only the refresh token and the
  file system and AsyncStorage hold no patient data.
- Error responses never include stack traces, SQL or internal IDs beyond the request ID.
- Network faults in the API client: timeout, connection drop after a write was sent (retry with the
  same `Idempotency-Key` returns the first result), 409 stale version, 5xx with retry limits.
- Dependency audit, secret scan and Expo Doctor in CI.

## 9. Device and UI checks

| Check | How |
|---|---|
| Sizes | Android emulator at 360 × 640 dp and 411 × 891 dp; 10" tablet once per release |
| Physical phone | One mid-range Android phone on Wi-Fi at every release gate, connected via `adb reverse` or LAN (architecture §7) |
| Text scaling | 200% system font: no clipped text, no lost actions |
| Screen reader | TalkBack on the journey screens: every control named, correct roles, logical order |
| Touch targets | 48 dp minimum |
| Reduced motion | Animations off when the system setting is on |
| Keyboard | Forms scroll above the keyboard; next/done move between fields |
| Back button | Closes sheets and dialogs first; asks before discarding unsent input |
| Performance | Journey screens usable within 1 s on demo data; long lists virtualised; no dropped frames on scroll in a release build |
| iOS | Simulator and one device before any iOS release: safe areas, Keychain, camera permission text |

Each release gate records the devices, OS versions, Expo SDK and build used, with screenshots.

## 10. CI

One workflow for the repository, with jobs for: secret scan; shared, API and mobile typecheck,
lint and format; API unit and integration tests; database tests against a PostgreSQL 17 service
container (fresh migration and upgrade); mobile Jest; Expo Doctor; `npm audit --audit-level=high`.
A pull request merges only when all jobs pass.
