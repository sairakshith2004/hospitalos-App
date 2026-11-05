# Implementation plan

## Confirmed product decisions
- Product: HospitalOS Mobile
- Repository: hospitalos-App
- Platform: Android first; shared-codebase iOS support planned
- Mobile client: Expo + React Native + TypeScript
- Backend: independent service and independent PostgreSQL database
- First priority: design system and UI prototype
- Existing HospitalOS web repository: requirements reference only; do not modify or connect implicitly

## Milestones
1. Design foundation: tokens, glass surfaces, dashboard shell and design review.
2. Entry experience: splash, onboarding, hospital selection and login screens.
3. Role-aware navigation: role switch in design preview, permission-driven navigation after backend integration.
4. Independent API: Fastify, PostgreSQL, Prisma, migrations, API contracts and health endpoints.
5. Identity/security: password policy, secure session lifecycle, refresh token rotation, revocation, RBAC/permissions, audit events.
6. Core workflows: patients, appointments, reception, doctor, nursing.
7. Operations: pharmacy, laboratory, finance, HR, inventory and marketing.
8. Cross-cutting: notifications, offline-aware read cache, sync conflict handling, accessibility.
9. Verification: unit, API integration, end-to-end, Android emulator and physical-device validation.
10. Release: Android signing/distribution, privacy review, backup/restore drills and iOS validation.

## Quality gates
- Never connect mobile clients directly to PostgreSQL.
- Enforce permissions at the API boundary for every protected operation.
- Use synthetic data only during development.
- Audit sensitive record reads and all sensitive writes.
- No diagnostic or clinical decision-support features in the initial scope.
- Validate keyboard behavior, small screens, slow networks and reduced motion.
- Do not claim device testing until it has actually been run.

## First design prototype
The first screen is an administrator-style dashboard using synthetic example metrics and tasks. It validates palette, spacing, typography, translucent panels and content density. It is not yet wired to navigation or an API.
