# Build log

What was built, checked and decided, phase by phase. Results are recorded only when actually run.

## Release 0: design and mobile foundation

### Expo foundation and navigation shell (commit `b4dbe8d`, merged via PR #2)

- Expo SDK 57, Expo Router, strict TypeScript, design system and component showcase, navigation
  shell with protected routes, splash, onboarding and sign-in placeholders.
- Fixed: sign-out returned to splash instead of sign-in; tab queries assumed one platform.
- Checks: typecheck, lint, Prettier, Jest 37/37, Expo Doctor 21/21.

### Phase 1.0: roles, permissions and Inbox (commit `f7468ef`, merged via PR #3 as `c7e8910`)

- The 88 reference permissions and the reference role map for all 11 roles in the app; module
  visibility by real permissions (display only).
- Inbox replaced Notifications with a labelled "arrives in Release 7" state.
- Development role preview: no credential, no network code, absent in production builds.
- Dashboard demo data only for development demo sessions, labelled DEMO DATA; honest empty states
  otherwise; invented system-status chip removed; ESLint blocks sample data in workflow screens.
- Checks: typecheck, lint, Prettier, Jest 94/94 (9 suites), Expo Doctor 21/21.
- Not run: Android emulator and physical-device checks (KI-1).

## Release 1

### Phase 1.1: independent backend foundation (in progress, branch `phase/1.1-backend-foundation`)

**Audit (read-only, 2026-11-05).**

- Docker Desktop 29.8.2 started for inspection. The reference project `hospitalos` was running
  `hospitalos-db-1` (5432), `hospitalos-mailpit-1` (1025, 8025) and `hospitalos-livekit-1`
  (7880–7882); network `hospitalos_default`; volume `hospitalos_hms_pgdata`. None of our planned
  names (`hospitalos-mobile`, `hospitalos-mobile_default`, `hospitalos-mobile_pgdata`) existed;
  ports 4000, 5433, 1026, 8026 and 7890 were free.
- Expo workspace detection tested in scratch folders: a project left out of the workspace list
  keeps its own Metro root (AD-M-011).
- Deviation: a throwaway `docker run --rm postgres:17-bookworm --version` was run to read the
  PostgreSQL version, outside the read-only rule. It left no container, volume or network; only the
  image is cached (KI-5).

**Step 0.** Branch `phase/1.1-backend-foundation` created from `origin/main` (`c7e8910`), with no
upstream so it can't push to `main` by mistake.

**Step 1 (source files only; nothing installed, no Docker, no database).**

- Root: workspace `package.json` (`apps/api`, `packages/*`), `.npmrc` (exact versions), `.gitignore`,
  `.nvmrc`, `.prettierrc`, `.prettierignore`, `tsconfig.base.json`, `eslint.base.mjs`,
  `.env.example`, `docker-compose.yml` (project `hospitalos-mobile`, PostgreSQL 17.11 pinned by
  digest, `127.0.0.1:5433`, no auto-restart).
- `packages/contracts`: the 11 roles, 88 permissions and role map (identical to the reference and
  the app), error envelope, health and readiness schemas, tests.
- `apps/api`: validated settings, redacting logger, error envelope, request IDs, Helmet, JSON limit,
  `/v1/health`, `/v1/ready`, database identity guard, forward-only migration runner, migration
  `0000_extensions.sql`, server with clean shutdown, unit/HTTP tests and database tests.
- Scripts: `env-init.mjs`, `secrets-check.mjs` (verified to catch a planted secret), `iso-check.mjs`,
  `db-init.sh`; `docker/postgres/init-roles.sql`.
- Docs: this log, `ARCHITECTURE-DECISIONS.md`, `QUALITY-GATES.md`, `KNOWN-ISSUES.md`; decisions D1
  and D2 recorded; `packages/contracts` replaces `packages/shared` in the planning documents.
- Checks run: `secrets:check` passed (and caught a planted test secret); all JSON and scripts parse;
  `.env` and `apps/api/.env` are git-ignored. Mobile app unchanged (checksums of `package.json` and
  `package-lock.json` identical; no file changed under `apps/mobile`): typecheck, ESLint, Prettier and
  Jest 94/94 pass; Metro still uses `apps/mobile` as its root; `expo export --platform android`
  bundles 1,326 modules. Expo Doctor 20/21: four Expo patch releases published since Phase 1.0 (KI-9).
- Not yet run (approval gates): dependency installation, secrets, Docker resources, databases and
  users, migration `0000`, CI workflow. API typecheck, lint and tests need the dependencies first.

**Approval gate 1: dependencies (approved and run 2026-11-05).**

- Installed with exact versions; no `zod-to-openapi` (OpenAPI deferred to the first real endpoints).
  - Root (dev): `typescript@6.0.3`, `prettier@3.9.10`, `eslint@10.13.0`, `typescript-eslint@8.72.0`,
    `vitest@4.1.12`, `@types/node@24.19.2`.
  - `@hospitalos/contracts`: `zod@4.6.7`.
  - `@hospitalos/api`: `express@5.3.0`, `drizzle-orm@0.45.4`, `pg@8.23.1`, `pino@10.4.0`,
    `pino-http@11.0.0`, `helmet@8.3.0`, `zod@4.6.7`; dev: `drizzle-kit@0.31.11`, `tsx@4.23.15`,
    `supertest@7.3.1`, `@types/express@5.0.6`, `@types/pg@8.23.1`, `@types/supertest@7.2.1`.
- New root `package-lock.json` (382 packages). `apps/mobile/package.json` and its lockfile unchanged
  (checksums verified before and after).
- `npm audit --audit-level=high`: passes (0 high, 0 critical); 13 moderate in dev tooling (KI-10).
- npm blocked `esbuild`/`fsevents` install scripts; not approved, not needed (KI-11).
- ESLint: unused parameters allowed only with a leading underscore (Express error handlers need
  four parameters).
- Checks: `npm run check` passes (secrets 179 files, typecheck, lint, Prettier, contracts 10/10,
  API 32/32). Mobile: typecheck, ESLint, Prettier, Jest 94/94 pass; Expo Doctor 20/21 (KI-9).

**Phase 1.1 completion (2026-11-05, one session, owner-authorized local steps).**

- Starting state verified: branch `phase/1.1-backend-foundation`, clean and in sync with its new
  remote branch (pushed at the owner's request as `597a24b`); Phase 1.0 `f7468ef` is in `origin/main`
  through PR #3. Ports 4000 and 5433 free; Docker inventory identical to the audit above.
- Names superseding the step 1 notes: probes are `/api/health` and `/api/ready`; network
  `hospitalos-mobile-network`; volume `hospitalos-mobile-pgdata`; init SQL
  `docker/postgres/init/01-roles-and-databases.sql`.
- Fixed: one ESLint error (`readiness.ts`) and three unformatted files. Four configuration tests
  used fixtures shorter than the 32-character password rule and expected `hospitalos_test` in the
  default allow-list; fixtures now satisfy the rule and the expectation matches the stricter code.
  The migration database test wrongly expected `hos_app` to be denied any read of
  `schema_migrations`; it now checks read-only access (readiness needs the read).
- Added: schema comment in `0000_extensions.sql` (not yet applied anywhere when changed);
  `revoke connect on database postgres from public`; tests for short passwords, `hms_*` refusal and
  test-database use; database tests for readiness, least privilege, migration record, schema
  metadata, maintenance-database refusal and the real server process (probes, SIGTERM exit 0, no
  password in logs, refusal as owner); `.github/workflows/ci.yml`.
- Run, in order: `npm run env:init` (root `.env`, mode 600, values never printed);
  `npm run db:env:check`; `npm run iso:check`; `npm run db:up` (PostgreSQL 17.11, healthy,
  `127.0.0.1:5433`); `npm run db:init` twice (second run changed nothing);
  `npm run db:migrate` and `db:migrate:test` twice (first applied `0000_extensions.sql`, second
  skipped it); live API on `127.0.0.1:4000`: health 200, ready 200, unknown route 404 envelope,
  200 kB body 413 `PAYLOAD_TOO_LARGE`, bad JSON 400 `INVALID_JSON`, SIGTERM exit 0 with
  "shutdown complete", no password in the log.
- Database state: `hos_owner` and `hos_app` with no superuser, create-role, create-database,
  replication or bypass-RLS rights; `hos_app` has CONNECT on the two project databases only, USAGE
  but not CREATE on `public`, SELECT only on `schema_migrations`. Each database has one migration
  record (same checksum), extensions `btree_gist 1.7`, `citext 1.6`, `pg_trgm 1.6`, `pgcrypto 1.3`,
  and no table other than `schema_migrations`.
- Docker after: three new resources only (`hospitalos-mobile-db`, `hospitalos-mobile-network`,
  `hospitalos-mobile-pgdata`) plus the pinned image. The reference containers, network and volume
  have the same IDs, start times and zero restarts as before.
- Checks: root `npm ci` (lockfiles unchanged by checksum); `npm run check` passes (secrets 184 files,
  typecheck, lint, Prettier, contracts 10/10, API 38/38); `npm run test:db` 19/19; root audit 0 high
  or critical (13 moderate, KI-10). Mobile unchanged (no file under `apps/mobile` modified):
  typecheck, ESLint, Prettier, Jest 94/94; Expo Doctor 20/21 (KI-9); mobile audit 5 high (KI-12).
- Not run: the CI workflow itself (runs on the next push); Android emulator or device (KI-1).

**Phase 1.1 owner review (2026-11-05, after commit `059e220`; first CI run passed both jobs).**

- AD-M-015 and AD-M-016 approved by the owner (wording updated). The report-only mobile audit step
  was replaced with `npm run mobile:audit`, which blocks CI on any high or critical advisory not
  classified in `scripts/mobile-audit-exceptions.json` and prints classified ones as warnings;
  verified to fail when an exception is removed.
- Five mobile high findings classified (KI-12): two advisories, one production path
  (`decode-uri-component` through Expo Router link parsing), one development-only (`zod`). Tested in
  scratch copies only: the `decode-uri-component` 0.5.1 override breaks parsing (rejected); the Expo
  patch upgrade passes typecheck, ESLint, Jest 94/94, Expo Doctor 21/21 and the Android export, and
  clears `@expo/cli`. Not applied: needs the owner's approval as a mobile dependency change.
- Re-verified: Git root, remote, branch; outer folder untouched; databases, roles, grants and live
  `hos_app` refusals; `/api/health` and `/api/ready` 200; SIGTERM exit 0; `hms_*` refused by API
  start-up, allow-list and migration tool; reference Docker resources identical to the baseline.
- Checks: secrets (186 files), typecheck, ESLint, Prettier, contracts 10/10, API 38/38, database
  19/19, iso:check, root audit, mobile audit gate, mobile typecheck/ESLint/Prettier, Jest 94/94,
  `git diff --check` pass; Expo Doctor 20/21 (KI-9). Database stopped with `npm run db:down`;
  volume kept.

**Phase 1.1 final review, day 2 (2026-11-06).**

- Verified: Git root, remote, branch, clean history (`059e220` local and remote; `origin/main` at
  `c7e8910`, 2 commits behind the branch). CI run 42035850249 on `059e220` passed both jobs; its
  annotations show the two report-only mobile steps (Expo Doctor, old mobile audit) exited 1 as
  expected. The new blocking mobile audit gate has not run on GitHub yet.
- **Bug found and fixed:** stopping the database while the API ran crashed the API (unhandled `error`
  event from the `pg` pool when PostgreSQL closed an idle connection, code `57P01`), so health and
  readiness both stopped answering. `createPool` now always listens for idle-connection errors; the
  server logs them with the PostgreSQL code only. After the fix: database down gives
  `/api/ready` 503 `NOT_READY` and `/api/health` 200; database back gives 200 again without a
  restart; SIGTERM exit 0. New tests (unit: the pool survives and reports the error; database: the
  real server survives its connections being terminated and recovers) fail without the fix.
- KI-12 re-checked against the registry and measured (see the KI-12 update).
- Owner decisions: Expo patch and `zod` override deferred to 2026-11-19 (package-age policy);
  incoming-link guard approved as the first task of phase 1.2 (AD-M-017); commit and push to
  `phase/1.1-backend-foundation` approved; no merge into `main`. Not approved for production
  patient data or release while KI-1 and KI-12 remain open.

### Phase 1.2: authentication (in progress, branch `phase/1.2-authentication`)

**Branch.** Created from `phase/1.1-backend-foundation` at `2250fd6` (which holds the reviewed
phase 1.1 work not yet in `main`); no upstream until the owner approves a push.

**Task 1: incoming-link guard (AD-M-017), 2026-11-06.**

- `apps/mobile/src/features/links/link-guard.ts`: accepts only the `hospitalos:` scheme (Expo Go's
  `exp:`/`exps:` only in development builds); an explicit allow-list of 8 destinations (`/`,
  `/sign-in`, `/forgot-password`, `/home`, `/queue`, `/search`, `/inbox`, `/profile`); refuses
  over-long links, control characters, whitespace, backslashes and malformed percent-encoding;
  drops query strings and fragments; always returns an internal path, with `/` as the fallback.
- `apps/mobile/src/app/+native-intent.ts`: Expo Router's `redirectSystemPath` calls the guard for
  the first link and every later one. Checked in the installed Expo Router 57.0.29: no redirects
  are configured, so the raw link reaches the guard before any query parsing (Expo Go adds its own
  rewrite step first, in development only).
- ESLint now rejects external navigation: importing `Linking` from `react-native`, `expo-linking`
  or `expo-web-browser`, and hard-coded `scheme:` URLs in `href` or in
  `router.push`/`replace`/`navigate`/`dismissTo`. Verified with a probe file (5 errors) that
  internal links stay allowed.
- Tests: 69 guard unit tests (allowed links; 16 unsafe schemes; malformed, control-character,
  protocol-relative and over-long links; blocked destinations such as development tools and
  sign-out; the KI-12 payload decided quickly; results always internal; every allowed destination
  exists as a screen; active with `__DEV__` false). 7 router tests through Expo Router's test
  renderer: unknown and blocked incoming links open the splash, allowed ones open, `/home` still
  needs a session; 3 of them fail when the guard file is removed.
- Changed tests: the two not-found checks now navigate inside the app (`router.push`, marked
  `@ts-expect-error` because typed routes reject those paths at compile time), because incoming
  links no longer reach not-found. Same assertions.
- Checks: mobile typecheck, ESLint, Prettier, Jest 170/170 (11 suites);
  `expo export --platform android` bundles 1,328 modules. Mobile `package.json` and lockfile
  unchanged (no new dependency). Not run: Android emulator or device (KI-1).

## Release 1 (branch `release/r1-outpatient-operations`)

Created 2026-11-06 from `2250fd6` (the verified remote phase 1.1 commit; `origin/main` at `98d56ec`
holds phase 1.1 only up to `059e220`). The uncommitted link-guard work moved over unchanged.

### Phase 1.2: authentication and staff accounts (complete locally, uncommitted)

- **Deep links first (AD-M-017):** added repeated/identity parameters, unexpected hosts, encoded
  traversal, right-to-left override, and "never throws" tests (84 guard tests). The vulnerable
  parser itself is unchanged (KI-12): the guard keeps link input away from it.
- **Database:** `0001_identity.sql` (settings with the §5.6 security ranges as CHECKs; departments,
  employees, users, roles, permissions, role grants, user roles; append-only `audit_logs`;
  `auth_sessions` and `auth_tokens` with hash-only storage and a used-once trigger; login attempts
  and per-account-per-IP lockouts; reset codes stored as HMAC; reset requests counted by keyed
  identifier hash; idempotency keys; `hos_app` privileges narrowed per table; deferred trigger that
  keeps one active Super Admin). `0002_identity_fixes.sql` replaces that trigger function, which in
  0001 referenced a column the `users` branch doesn't have (found by tests; 0001 was already applied
  to `hospitalos_test`, so it was fixed forward, never edited). New migrations are now dry-run in a
  rolled-back transaction before they are applied.
- **API:** sign-in (argon2id via Node's built-in `crypto.argon2`, dummy hash for unknown users, 5
  failures per account per IP lock for 15 min, 10 failures per IP per 15 min → 429), refresh
  rotation with reuse detection that revokes the family, sign-out, sign-out everywhere, me and
  permissions, change password (other sessions revoked), forced change (`PASSWORD_CHANGE_REQUIRED`),
  forgot/reset by 8-digit code (HMAC with `RESET_CODE_PEPPER`, 15 min, 5 attempts, 3 per account and
  10 per IP per hour, generic 202/400), app-version gate (426), staff create (HR), role grant/revoke
  (SA; never self; last SA protected with an advisory lock plus the trigger; revoke ends sessions),
  account status (ADM/SA; ADM can't touch SA accounts; disable ends sessions), role and permission
  lists, authentication audit. Readiness also requires the permission catalogue to match the
  contracts.
- **Operator commands:** `db:seed` (11 roles, 88 permissions, 241 grants; refuses rather than
  deletes on drift), `api:bootstrap-admin` and `api:reset-password` (interactive, hidden password
  input, audited as `system`), `db:seed:demo` (development/test databases only, new random passwords
  printed once). The API refuses to start in production while demo accounts exist.
- **Email:** Mailpit added to our Compose project (`hospitalos-mobile-mail`, 127.0.0.1:1026/8026,
  pinned digest, no auto-restart); a minimal loopback-only SMTP client sends reset codes (no
  provider, no new dependency). `env-init --add-missing` added `RESET_CODE_PEPPER` and SMTP settings
  to the existing `.env` without printing values.
- **Security fixes found on the way:** the error handler logged whole error objects, and Drizzle
  query errors carry query parameters (token hashes, later patient values): now only the error name,
  PostgreSQL code and constraint are logged. `SELECT … FOR UPDATE` on `roles` needed privileges
  `hos_app` deliberately lacks; replaced by a transaction advisory lock.
- **Mobile:** `@hospitalos/contracts` used from source (TS path, Metro `watchFolders`, Jest mapping;
  AD-M-018); the app's permission copy replaced by re-exports (KI-6 resolved); `z` re-exported from
  the contracts and direct `zod` imports banned in the app (one zod instance). New dependencies
  (exact, both older than two weeks): `expo-secure-store` 57.0.4 (SDK 57), `@tanstack/react-query`
  5.104.5. Session manager (access token in memory, refresh token in SecureStore
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, single-flight refresh, app-version headers), real sign-in,
  forgot/reset and change-password screens, forced-change routing, restore at start (nothing renders
  until the check finishes), query cache cleared when a session ends. `EXPO_PUBLIC_API_URL` (HTTPS
  required outside development).
- **Checks:** API unit 48/48, database 53/53 (`hospitalos_test`), contracts 9/9, mobile 200/200
  (14 suites), typecheck, lint, Prettier, secrets (234 files), iso:check, root audit (0 high),
  mobile audit gate, `git diff --check`, Android export (1,486 modules). Not run: Android device.
- **Development database:** migrations 0001–0002 applied and access model seeded. No Super Admin
  or demo accounts created yet (bootstrap is interactive; see the README).

### Phases 1.3–1.11: API complete locally (uncommitted); mobile screens in progress

- **Migrations:** `0003_reference_data.sql` (doctor profiles, weekly hours, leave/blocks, service
  catalogue and prices, locations, ingredients, medicine products and strengths, batches with
  expiry/status, append-only stock movements, lab tests and parameters with ranges) and
  `0004_outpatient.sql` (patients with sequence MRNs, allergies, appointments with a GiST EXCLUDE
  constraint against double booking and unique daily tokens, nurse session assignments,
  encounters, vitals, append-only notes and diagnoses, prescriptions with validity, dispensings and
  lines tied to stock movements, lab orders and versioned results with an independent-verification
  CHECK, gapless document counters, invoices with one draft per visit and triggers that freeze
  issued invoices and their lines, append-only payments, billing corrections with separation of
  duties, follow-ups). Both dry-run in a rolled-back transaction first.
- **Seeds (development/test only):** synthetic departments, 4 doctors with hours and fees, services,
  4 lab tests with ranges, 8 medicines (generic + brand + strength) with batches including an
  expired, a near-expiry and a recalled batch. The demo doctor gets a profile and daily hours.
- **API modules:** reference data (fees/prices/hours changes audited), patients (registration,
  duplicate warning, MRN/phone/name search capped at 20 and audited, versioned demographics,
  allergies, visit history), scheduling (availability from hours in hospital time, booking,
  walk-in, check-in with token and consultation fee, cancel → fee deactivated or correction,
  reschedule, no-show, "did not arrive", queue), clinical (care-relationship and nurse-assignment
  record access, encounters, notes/addenda, diagnoses, vitals, audited chart written before data is
  returned, entered-in-error, nurse assignments, follow-ups with due/overdue computed when read),
  pharmacy (prescriptions with allergy acknowledgement and validity, cancel/close, queue, FEFO
  dispensing with batch locks in id order, expired/recalled/quarantined never used, near-expiry
  acknowledgement, substitution rules, idempotent), laboratory (orders with charges, collection with
  unique barcode, reject sample, processing, results with factual flags, verification by another
  person, reject results, cancel before collection), billing (invoice detail with collectable =
  total − paid − open corrections, issue with gapless number, idempotent payments with gapless
  receipts, receipt view, open corrections; no credit-note/refund/discount/export endpoint),
  dashboards (per-role figures from live queries only).
- **Tests (hospitalos_test):** the 15-step journey end to end with negative authorization at each
  stage; 10 simultaneous bookings (1 wins); 8 simultaneous registrations (distinct MRNs); duplicate
  warning and confirm; check-in day rules, reschedule, no-show; walk-in tokens and idempotency;
  concurrent dispensing never oversells (stock and movements checked); expired/recalled/near-expiry
  batches and FEFO across batches; expired prescription; draft recalculation vs correction on an
  issued invoice and the payment cap; database refuses to rewrite an issued invoice; concurrent
  payment retries record one payment; no R3 endpoints; lab step order and unique barcodes.
- **Checks:** API unit 48/48, database 71/71, typecheck and ESLint clean.
- **Next:** mobile screens for each role on these endpoints (Home dashboard, Search and patient,
  Register, Book, Reception queue, Doctor encounter, Nurse vitals, Pharmacy dispense, Lab worklist,
  Billing invoice/pay/receipt, Follow-ups), then R1 hardening and the documentation deliverables.

### Release 1 completion run (2026-11-06, uncommitted)

- Mobile screens built on the API for every R1 role: live Home figures; role-aware Work Queue
  (reception check-in/cancel/no-show, doctor queue, nurse queue, pharmacy, lab, billing); Search;
  Register (duplicate warning and confirmation); Patient; Chart; Book and Book follow-up;
  Follow-ups; Consultation workspace (notes, diagnosis, prescription with allergy confirmation, lab
  orders, follow-up, complete, addendum); Vitals; Dispense; Lab order; Invoice with issue, payment
  and receipts; Staff accounts; Nurse assignments. Shared `QueryBoundary`, query hooks,
  idempotency keys, rupee formatting from paise.
- API additions: opt-in CORS for the development web build (AD-M-023); `ApiError` keeps the raw
  body so the app can read duplicate candidates. Web token store memory-only (AD-M-024).
- Browser journey on the web build against the real API with the demo accounts: passed end to end
  (₹868.00 invoice = ₹500 consultation + ₹350 CBC + 9 × ₹2; FEFO batch PCM-A0; verification by a
  second person; receipt shown). Admin screens: nurse assignment created, staff list shown.
- CI: the mobile job now installs the root workspace too (the app reads the contracts' zod).
- Checks: contracts 9/9, API 49/49, database 71/71, mobile 210/210, typecheck/ESLint/Prettier
  clean, secrets (299 files), iso:check, root audit, mobile audit gate, Android export (1,523
  modules), `git diff --check`; Expo Doctor 20/21 (KI-9).
- Not done: Android emulator and physical-device runs (KI-1, KI-21), so Release 1 is **not
  complete**. Report: `docs/R1-RELEASE-REPORT.md`.
- Resume point if interrupted: Android device checklist (roadmap §3.1 and §3 phase 1.12), then
  owner review of AD-M-018 to AD-M-024.
