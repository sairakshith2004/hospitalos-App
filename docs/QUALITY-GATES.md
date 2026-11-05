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
