# HospitalOS Mobile

An independent, Android-first, iOS-compatible hospital operating system for one multispecialty
outpatient hospital: Expo + React Native + TypeScript app, its own Express 5 API and its own
PostgreSQL 17 database. All 11 roles and all 88 reference permissions, delivered in releases R1 to
R9 ([roadmap](docs/MOBILE-IMPLEMENTATION-ROADMAP.md)).

## Product boundaries

- Separate from the HospitalOS web application, which is a requirements reference only. This
  project never connects to, reuses or modifies its code, database, credentials or Docker resources.
- The app talks to the API over HTTPS only; it never connects to PostgreSQL.
- The API authorizes every request. Hiding a button is never security.
- Synthetic data only. No diagnosis, treatment or dose recommendations.

## Repository layout

```text
apps/
  mobile/          Expo app (own lockfile; joins the workspace in phase 1.2)
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

**API and database** (phase 1.1). Each step below is a separate, owner-approved action the first
time it is run:

| Step | Command                                            | What it does                                                                  |
| ---- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1    | `npm install`                                      | Installs the API and contracts dependencies (root lockfile)                   |
| 2    | `npm run env:init`                                 | Writes `.env` and `apps/api/.env` with random secrets (git-ignored, mode 600) |
| 3    | `npm run iso:check`, then `npm run db:up`          | Checks names and ports, then starts our PostgreSQL container                  |
| 4    | `npm run db:init`                                  | Creates `hospitalos_dev`, `hospitalos_test`, `hos_owner` and `hos_app`        |
| 5    | `npm run db:migrate` and `npm run db:migrate:test` | Applies migrations as `hos_owner`                                             |
| 6    | `npm run api:dev`                                  | Starts the API on `http://127.0.0.1:4000` (`/v1/health`, `/v1/ready`)         |

Checks: `npm run check` (secrets, types, lint, format, unit tests) and `npm run test:db`.

### Isolation from the reference project

|                   | Reference                                      | HospitalOS Mobile                                            |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Compose project   | `hospitalos`                                   | `hospitalos-mobile`                                          |
| Network / volume  | `hospitalos_default` / `hospitalos_hms_pgdata` | `hospitalos-mobile_default` / `hospitalos-mobile_pgdata`     |
| PostgreSQL port   | 5432                                           | 5433                                                         |
| API port          | 3000                                           | 4000                                                         |
| Databases / users | `hms_dev`, `hms_test` / `hms_owner`, `hms_app` | `hospitalos_dev`, `hospitalos_test` / `hos_owner`, `hos_app` |

The API refuses to start against any database or user outside this list.

## Secrets

Secrets live only in the git-ignored `.env` and `apps/api/.env`, generated locally. They never
appear in code, documentation, logs, screenshots or the app bundle. `npm run secrets:check` fails
if one is found in any file Git tracks or would track.

## Documentation

- [Product scope](docs/MOBILE-PRODUCT-SCOPE.md) · [Roles and permissions](docs/MOBILE-ROLE-MODULE-MATRIX.md) ·
  [Workflows](docs/MOBILE-WORKFLOWS.md) · [Architecture](docs/MOBILE-ARCHITECTURE.md) ·
  [Roadmap](docs/MOBILE-IMPLEMENTATION-ROADMAP.md) · [Test strategy](docs/MOBILE-TEST-STRATEGY.md)
- [Architecture decisions](docs/ARCHITECTURE-DECISIONS.md) · [Build log](docs/BUILD-LOG.md) ·
  [Quality gates](docs/QUALITY-GATES.md) · [Known issues](docs/KNOWN-ISSUES.md)
- [Design system](docs/DESIGN-SYSTEM.md)
