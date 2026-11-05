# HospitalOS Mobile delivery roadmap

Every step follows the same process and ends at a review gate. A step does not start until the
previous gate is signed off.

## Step process

1. **Scope** — restate the step's goal and its explicit exclusions.
2. **Build** — smallest change that meets the goal; domain logic separate from UI.
3. **Verify** — `npm run check` (typecheck, lint, format, tests) and `npx expo-doctor`; layout
   screenshots at 320 / 390 / 1024 dp for UI steps; API and migration tests for backend steps.
4. **Review** — self code review (correctness, security, accessibility, design-token use),
   fix verified findings, re-run checks.
5. **Document** — update READMEs, design or API docs, and this roadmap's status.
6. **Gate** — report results, known limitations and anything needing human review. Commit as one
   reviewed checkpoint once approved.

Device claims are only made when a device or emulator was actually used.

## Status

| # | Step | Phase | Status |
| --- | --- | --- | --- |
| 1 | Repository audit | Foundation | Done |
| 2 | Expo foundation (SDK 57, Expo Router, TypeScript) | Foundation | Done |
| 3 | Engineering baseline (strict TS, lint, format, env config, tests) | Foundation | Done |
| 4 | Design system and component showcase | Foundation | Done |
| 5 | Navigation shell, protected routes, dev role preview | Mobile prototype | Checks pass; awaiting Android device check |
| 6 | Splash and onboarding | Mobile prototype | Planned |
| 7 | Authentication UI (no backend) | Mobile prototype | Planned |
| 8 | Role dashboards for all 11 roles | Mobile prototype | Planned |
| 9 | Reception and scheduling prototype | Mobile prototype | Planned |
| 10 | Doctor and nurse prototype | Mobile prototype | Planned |
| 11 | Pharmacy and laboratory prototype | Mobile prototype | Planned |
| 12 | Finance, HR, inventory, administration, marketing prototype | Mobile prototype | Planned |
| 13 | Prototype audit and Release 1 scope freeze | Mobile prototype | Planned |
| 14 | API foundation (Fastify, PostgreSQL, Prisma, OpenAPI, Docker) | Backend | Planned |
| 15 | Identity, sessions and authorization | Backend | Planned |
| 16 | Release 1 workflows: patients, doctors, appointments | Backend | Planned |
| 17 | Mobile ↔ API integration for Release 1 | Integration | Planned |
| 18A–F | Clinical and operational domains (doctor/nurse, pharmacy, lab, finance, HR/inventory, admin/marketing) | Domains | Planned |
| 19 | Notifications and offline safety | Hardening | Planned |
| 20 | Security and quality audit | Hardening | Planned |
| 21 | Android release candidate and iOS readiness | Release | Planned |

## Standing rules

- Independent product: never connect to or modify the existing HospitalOS web backend/database.
- Synthetic data only, visibly labelled. No real patient, employee or financial data.
- Permissions are enforced by the API. Client-side role previews are development tooling only.
- No diagnostic, treatment, dose or result-interpretation features.
- Secrets never enter Git; `.env.example` holds placeholders only.
