# Quality gates

What must be true before a phase is reported done, committed or released. A gate is reported only
when it was actually run; device, emulator, security and deployment results name what was used.

## Every phase

| Gate | Mobile (`apps/mobile`) | API and packages (repository root) |
|---|---|---|
| Types | `npm run typecheck` | `npm run typecheck` |
| Lint | `npm run lint` | `npm run lint` |
| Format | `npm run format:check` | `npm run format:check` |
| Unit and component tests | `npm test` | `npm test` |
| Database tests | — | `npm run test:db` (only `hospitalos_test`) |
| Migrations | — | fresh database and re-run (idempotent); edited migration refused |
| Expo | `npx expo-doctor`; `npx expo export --platform android` when dependencies or workspace layout change | — |
| Secrets | — | `npm run secrets:check` |
| Isolation | — | `npm run iso:check` when Docker configuration changes; reference project's containers, network and volume unchanged |
| Dependencies | `npm audit --audit-level=high` | `npm audit --audit-level=high` |
| Whitespace | `git diff --check` | `git diff --check` |

## Approval gates (never run without explicit owner approval)

1. Installing or upgrading dependencies.
2. Generating or changing credentials and secrets.
3. Creating Docker containers, networks or volumes.
4. Creating databases or database users.
5. Running migrations or seeds on any database.
6. Adding or changing CI workflows.
7. Destructive actions of any kind, and anything that contacts an outside service.
8. Commits, pushes and merges.

## Release gates

- Every acceptance criterion of the release passes.
- Positive and negative authorization tests for every endpoint and role (SE-1).
- Android emulator at 360 × 640 and 411 × 891 dp, and a physical Android phone, with a written
  device report.
- No high or critical security findings open.
- Owner sign-off.

## Definition of done for a feature

UI, API, permission checks, business rules, database persistence, audit trail and tests all work.
A screen that only renders is not a finished feature.

## Last full run: R1.13 (2026-11-06, Mac, uncommitted working tree)

| Gate | Result |
|---|---|
| Secrets (`npm run secrets:check`) | Pass, 302 files |
| Typecheck / ESLint / Prettier (root) | Pass |
| Contracts (Vitest) | 9/9 |
| API unit and HTTP (Vitest + Supertest) | 50/50 |
| Database (`hospitalos_test`) | 71/71 in 8 files |
| Migrations | 5 forward-only migrations, applied to `hospitalos_dev` and `hospitalos_test`; idempotency and edited-migration refusal covered by the database suite |
| Mobile typecheck / ESLint / Prettier | Pass, locally **and in a clean clone** (CI conditions) |
| Mobile Jest | 232/232 in 16 suites (KI-15 act warnings remain) |
| Isolation (`npm run iso:check`) | Pass |
| Root `npm audit --audit-level=high` | 0 high, 0 critical (13 moderate, development tools, KI-10) |
| Mobile audit gate (`npm run mobile:audit`) | Pass: 5 high from 2 classified advisories (KI-12), none unclassified |
| Expo Doctor | 20/21 (patch updates deferred to 2026-11-19, KI-9) |
| Android export | 1,523 modules (Hermes) |
| `git diff --check` | Pass |
| Live API, 11 roles (`hospitalos_dev`) | 11/11 |
| Live outpatient journey (`hospitalos_dev`) | 59/59 checks |
| Web build, 11 roles through the UI (Playwright, 360 × 640) | 11/11 (web preview, **not** Android) |
| Android emulator 360 × 640 and 411 × 891 | **Not run** (no Android SDK) |
| Physical Android phone | **Not run** |
| Release gate | **Not met** |
