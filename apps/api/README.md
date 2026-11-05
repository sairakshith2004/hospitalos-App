# @hospitalos/api

The independent HospitalOS Mobile API: Node.js 24, Express 5, TypeScript, Zod, Drizzle ORM and
PostgreSQL 17. It never connects to the reference HospitalOS web project or its database.

Phase 1.1 (backend foundation): health and readiness only. No accounts, patients or hospital data.

## Endpoints

| Method and path  | Access | Answers                                                                           |
| ---------------- | ------ | --------------------------------------------------------------------------------- |
| `GET /v1/health` | public | `200 { "status": "ok" }`; never touches the database                              |
| `GET /v1/ready`  | public | `200 { "status": "ready", "checks": { "database": "ok" } }`, or `503` `NOT_READY` |

Every error is `{ "error": { "code", "message", "requestId", "fields"? } }`
(`@hospitalos/contracts`). Every response carries `X-Request-Id`.

## Safety guards

- Settings are validated at start-up (`src/config/env.ts`). A missing, malformed or placeholder value
  stops the API with a message that names the setting, never its value. Secrets can be given as
  `NAME_FILE=/path`.
- The API refuses any database not named in `DATABASE_ALLOWED_NAMES` (only `hospitalos_*` names are
  accepted), any user other than `hos_app`, and any user with superuser, create-role,
  create-database, replication or bypass-RLS rights (`src/db/guards.ts`). Migrations do the same with
  `hos_owner`.
- Logs are structured JSON with passwords, tokens, codes, cookies, `Authorization` headers and
  connection strings redacted (`src/security/redaction.ts`).
- Security headers (Helmet), a 100 kB JSON limit, no `X-Powered-By`, generic 500s.

## Scripts

| Command                                  | What it does                                                     |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                            | Start with reload (`tsx watch`, reads `apps/api/.env`)           |
| `npm run start`                          | Start once                                                       |
| `npm run typecheck` / `lint`             | TypeScript / ESLint                                              |
| `npm test`                               | Unit and HTTP tests (no database)                                |
| `npm run test:db`                        | Database tests, `hospitalos_test` only                           |
| `npm run db:migrate` / `db:migrate:test` | Apply migrations as `hos_owner` to dev / test                    |
| `npm run db:generate`                    | Generate SQL from the Drizzle schema into `./drizzle` for review |

## Migrations

Forward-only SQL files in `src/db/migrations/NNNN_name.sql`, each run once in its own transaction
and recorded with a SHA-256 checksum in `schema_migrations`. Editing an applied file is refused;
corrections are a new migration. `0000_extensions.sql` enables `pgcrypto`, `citext`, `pg_trgm` and
`btree_gist` and creates no tables.

## Local setup

The repository README lists the order: install, `npm run env:init`, `npm run db:up`,
`npm run db:init`, `npm run db:migrate`, then `npm run api:dev`. Each of these is a separate,
approved step in phase 1.1.
