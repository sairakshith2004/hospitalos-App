# @hospitalos/contracts

The one shared contract between the HospitalOS API and the mobile app (decision D1):

- `ROLE_CODES` and `ROLE_NAMES`: the 11 reference roles.
- `PERMISSIONS` and `ROLE_PERMISSIONS`: exactly the 88 reference permissions and each role's grants.
- Request and response schemas (Zod), error codes and the error envelope.

The API is the only authority for authorization. The app uses these values only to decide what to
show.

Tests keep this package equal to `docs/MOBILE-ROLE-MODULE-MATRIX.md` and, until the mobile app
imports this package in phase 1.2, to the app's own copy in `apps/mobile/src/features/access/`.

TypeScript source is consumed directly (`exports` points at `src/index.ts`); there is no build step.
