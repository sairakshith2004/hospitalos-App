# HospitalOS Mobile

An independent, Android-first, cross-platform mobile application for multispecialty hospital operations. Built with Expo, React Native and TypeScript, with a separately owned backend planned for later milestones.

## Product boundaries
- This repository is separate from the existing HospitalOS web application.
- The existing web application is a requirements and workflow reference only.
- This project will have its own API, PostgreSQL database, authentication, authorization and audit trail.
- The mobile app will communicate with the API over HTTPS; it will never connect directly to PostgreSQL.
- Development uses synthetic data only.

## Design direction
Midnight navy surfaces, restrained glassmorphism, clinical cyan and violet accents, clear typography, accessible contrast, responsive layouts and purposeful motion. 3D effects are selective and must not compromise performance or usability.

## Planned workspace
```text
apps/
  mobile/     # Expo React Native client
  api/        # Independent API (later milestone)
packages/
  contracts/  # Shared API contracts
  config/     # Shared tooling configuration
docs/
```

## Initial milestone: design prototype
Build and validate the visual system, responsive role dashboard, splash, onboarding and login screens before backend integration.

## Roles in product scope
1. Super Admin
2. Hospital Administrator
3. Receptionist
4. Doctor
5. Nurse
6. Pharmacist
7. Lab Technician
8. Accountant / Finance Manager
9. HR Manager
10. Inventory / Procurement Manager
11. Marketing Manager

## Development principles
- Enforce permissions on the server; hiding UI controls is not authorization.
- Use synthetic demo records until security, legal and clinical review is complete.
- Audit sensitive reads and writes.
- No diagnostic or clinical decision-support claims.
- Support reduced motion and accessible touch targets.

## Local development
The app workspace will be bootstrapped with the current Expo SDK in the next implementation milestone. See `docs/IMPLEMENTATION-PLAN.md` for sequencing.
