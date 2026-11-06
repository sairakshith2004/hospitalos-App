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
