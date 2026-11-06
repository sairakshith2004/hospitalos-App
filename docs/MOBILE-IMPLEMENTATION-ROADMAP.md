# HospitalOS Mobile: implementation roadmap

Status: **final draft for owner review**, 2026-11-05 (all owner decisions of 2026-11-05 applied,
including D1 to D6 and the Release 1 corrections MD-20 to MD-23).
Replaces `docs/ROADMAP.md` and `docs/IMPLEMENTATION-PLAN.md` once approved.

Decisions referenced here (MD-1 to MD-23) are in the
[product scope](MOBILE-PRODUCT-SCOPE.md#2-approved-decisions-owner-2026-11-05); new acceptance IDs
(MA-*, MB-*, DO-*, ISO-*, AV-*, DX-*, RT-*, ACC-*, F0-*, JB-7 to JB-10) are defined in the [test strategy](MOBILE-TEST-STRATEGY.md).

## 1. How every phase runs

1. **Plan:** goal, exclusions, files, database changes, new packages, security impact, tests and
   what "done" means. The owner approves before anything is built.
2. **Separate approval** even inside an approved phase for: installing packages, creating or
   applying migrations, seeds, credentials, and anything that contacts an outside service.
3. **Build:** API, database and mobile screens for the phase together, with their tests. Rules live
   once in `packages/contracts` (decision D1). Screens read their data from the API (MD-12).
4. **Verify:** the phase's acceptance criteria plus the standing gate (section 2).
5. **Document:** README, these documents and the status table (section 5).
6. **Gate:** report results, known limits and anything needing human review; commit only when the
   owner asks; one branch and one pull request per phase.

Device results are reported only when a device or emulator was actually used.

## 2. Standing gate (every phase)

- Mobile: typecheck, lint, format check, Jest, `npx expo-doctor`.
- API: typecheck, lint, format check, unit tests, database tests on `hospitalos_test`, migration
  check (fresh database and upgrade from the previous migration).
- Secret scan, `npm audit --audit-level=high`, `git diff --check`.
- Every new endpoint in the role × endpoint test (SE-1); every new screen tested for its permission
  states.
- No workflow screen imports app-side fixture data (lint rule, DO-3).
- UI phases: screenshots at 360 × 640 dp and 411 × 891 dp, text scaling at 200%, screen-reader
  labels, reduced motion; on the Android emulator, and a physical phone at each release gate.

## 3. Release 1: integrated outpatient journey

| Phase | Name | Depends on | Delivers | Acceptance criteria |
|---|---|---|---|---|
| 1.0 | Mobile foundation alignment | Android emulator available (U1); no API needed | See section 3.1 | F0-1 to F0-6; all existing checks pass; Android emulator and physical-phone checklist done where possible (U1) |
| 1.1 | Workspace and API foundation | 1.0 | npm workspaces (`apps/api`, `packages/*`; the mobile app stays outside until 1.2); `packages/contracts` (D1); `apps/api` (Express 5, Zod env, pino with redaction, request IDs, error envelope, OpenAPI from shared schemas, `/v1/health`, `/v1/ready`); Docker Compose project `hospitalos-mobile` with PostgreSQL 17 on 5433 and Mailpit on 1026/8026; `hos_owner` / `hos_app`; migration runner; CI **ISO-0 first** (live Docker check before any database is created), then ISO-1 to ISO-4; root `.gitignore` for `apps/api/.env` added before the file exists; API refuses to start on a database other than `hospitalos_*` or as a user other than `hos_app`; refuses missing or placeholder secrets naming the setting only; `/v1/ready` fails when the database is down; log capture finds no redacted field; fresh-database migration in CI |
| 1.2 | Identity, sessions, audit | 1.1 | Users, employees, roles, permissions, user roles, audit log (append-only trigger), `auth_sessions`, `auth_tokens`, `password_reset_codes`; sign-in, refresh, sign-out, me, change password, forced change, forgot and reset code; lockout and rate limits; configurable security limits with allowed ranges (architecture §5.6); **app-version check** (`X-App-Version`, version policy, `426`); `requirePermission`; **seed of the 11 roles and 88 permissions in every environment**; **audited Super Admin bootstrap and operator password reset** (command line); **demo accounts with disposable random credentials in development and test only**; mobile sign-in, forgot-password, change-password screens and session manager; **local demo session retired** (development builds sign in to seeded accounts) | MA-1 to MA-14 (with boundary tests); AV-1 to AV-4; SE-2, SE-4, SE-6; AD-8; ACC-1 to ACC-5; demo accounts have synthetic work emails; the operator reset works for an account without one; seeded grants equal the matrix (test); app permissions come only from `/v1/auth/me` (DO-4) |
| 1.2b | Minimal staff-account administration | 1.2 | HR adds a staff member and login (temporary password, forced change); SA grants and revokes roles; ADM/SA disable and re-enable accounts; reasons and audit on every change; mobile screens Add staff member, Staff access, Disable account (MD-23, architecture §6.3) | ACC-6 to ACC-8; AD-2 (disable/enable part), AD-3, AD-4, AD-8 |
| 1.3 | Hospital reference data | 1.2 | Settings, departments, locations, doctor profiles, schedules, exceptions, holidays, fees, service catalogue and prices, medicine catalogue with ingredients and batches, lab tests and parameters: tables, **synthetic seed in the database**, read endpoints | Seed repeatable and synthetic; settings keys each owned by one permission; RX-2 product distinctions in the seed; DO-1 (every list the journey needs is served by the API) |
| 1.4 | Patients | 1.2, 1.3 | Registration with MRN, duplicate warning, search (MRN/phone/name), demographics edit, allergies and history tables; mobile Search, Register, Patient summary | PR-1 to PR-4; search capped at 20 rows; `patient.record.listed` audited; HR/INV/MKT get 403 (AX-9 part) |
| 1.5 | Scheduling, check-in and queue | 1.4 | Doctor availability from seeded schedules, booking with EXCLUDE constraint, reschedule, cancel, no-show, walk-ins with gap-free tokens, check-in with fee line on the visit's draft invoice, queue, day list; mobile Doctor availability, Book, Reschedule, Cancel, Walk-in, Check-in, Queue | SC-1, BK-1 to BK-5 (BK-2 with 10 parallel connections), QU-1 to QU-3, CF-1 to CF-3, L3 queue scope; cancel after check-in on a draft → MB-1 |
| 1.6 | Consultation and nursing | 1.5 | Care-relationship access; **nurse assignments** (ADM/SA assign a nurse to a doctor session on a date, revoke); My patients today; vitals; encounters, notes, diagnoses, allergies, history; entered in error; addenda; chart; other doctors' reports on request; mobile My appointments, My queue, Chart, Encounter, Nurse assignment, Nurse screens | AX-1 to AX-3, AX-7, AX-8, AX-11 to AX-13, QU-4, CN-1 to CN-3; nurse has no note, diagnosis, prescription or task action (403 test for each) |
| 1.7 | Prescriptions and dispensing | 1.6 | Prescriptions with allergy acknowledgement and substitution flag; medicine availability search; pharmacy queue; FEFO dispensing with expiry rules, substitution, idempotency, medicine lines on the draft invoice; close; pharmacy patient lookup; mobile Prescribe, Medicine search, Pharmacy queue, Dispense | RX-1 to RX-4, DP-1 to DP-4, DP-6 to DP-8, DP-10, EX-1 to EX-5, SB-1 to SB-5 |
| 1.8 | Laboratory | 1.6 | Lab orders with charge lines, cancellation, worklist, barcode collection (camera), results with factual abnormal flags, verification by another technician, amendments, verified report **viewed in the app only** (no export or sharing), lab patient lookup | LB-1 to LB-5; lab cancel on a draft → MB-1; on an issued invoice → MB-2 |
| 1.9 | Basic billing and payments | 1.5, 1.7, 1.8 | Invoices (gapless numbers, commit-time totals check, tax columns present at 0% until R3), issue, payments (cash/card/UPI/bank, part payments, idempotent), receipts, outstanding vs unbilled; receipts **viewed in the app only**; **billing corrections** (opened by cancellations of services on issued invoices with `initiated_by`; payments never above the valid outstanding balance; read-only list for FIN/ADM/SA); billing patient lookup; mobile Invoice, Pay, Receipt, Corrections | CF-4, CF-5, BL-1 to BL-4, BL-8 to BL-10, MB-1 to MB-5, MB-9; **no credit note can be created in R1** (test); no export or share action exists (test) |
| 1.10 | Follow-ups and time-based states | 1.5, 1.6 | Recommend, book, cancel; reception books the follow-up; overdue computed when read; past `booked` appointments shown as "did not arrive" and not check-in-able; prescription validity enforced at dispensing. **No end-of-day job** (R2, MD-21) | FU-1 to FU-4; time-based state tests (test strategy §4) |
| 1.11 | Dashboards | 1.4–1.10 | Home for REC, DOC, NUR, PHA, LAB, FIN, ADM, SA from live API queries; labelled "arrives in Release N" states for HR, INV, MKT; server-issued sessions get every figure from the API; the development-only demo dashboard stays available for demo sessions in development builds, labelled DEMO DATA | DB-1 (seeded data, exact values asserted); DO-2 (no figure for a server session without an API source); F0-7 still passes |
| 1.12 | Release 1 hardening and build | all above | End-to-end journey test; security review of R1; performance pass on a mid-range Android phone; Android internal build (EAS preview profile or documented local build); physical-device check of the journey; minimum-version enforcement exercised with an old build | The 15-step scenario passes on emulator and a physical phone; no high or critical findings open; owner sign-off |

### 3.1 Phase 1.0 in detail: mobile foundation alignment

**Goal.** The app's access model matches the reference exactly (11 roles, 88 permissions), the
Inbox tab replaces Notifications with an honest placeholder, and the development role preview is
provably unable to authorize anything, without changing the design system or the navigation
foundation.

**Not in this phase.** No API, database, packages, migrations or new screens beyond Inbox; no
change to design tokens or components except one icon name.

**Work, by file** (all under `apps/mobile/src`):

| # | Change | Files |
|---|---|---|
| 1 | Replace the 14 placeholder codes with the reference's **88 permission codes** (transcribed, in reference order, with the same names) | `features/access/permissions.ts` |
| 2 | Add the reference role codes (SA, ADM, REC, DOC, NUR, PHA, LAB, FIN, HR, INV, MKT) to the 11 roles and correct the role summaries from the reference (SA = head of the hospital with every permission; HR without payroll screens; MKT = outreach, no patient data) | `features/access/roles.ts` |
| 3 | Add the **role → permission map** exactly as the reference's (SA = all 88) | new `features/access/role-permissions.ts` |
| 4 | Module visibility uses the real codes: each module is visible with **any of** its permissions (table below); each module screen states the release it arrives in. Nursing is a role workspace (NUR, and SA), because doctors also hold `vitals:record`; this is display only, never authorization | `features/access/modules.ts`, `features/shell/ModuleScreen.tsx` |
| 5 | The demo session takes its permissions from the role map instead of its own approximate list; it keeps `kind: 'demo'`, has **no credential field**, and still can't be created when `devToolsEnabled` is false | `features/dev/demo-session.ts`, `features/session/types.ts` |
| 6 | **Inbox** replaces Notifications: route `(tabs)/inbox`, tab label "Inbox", screen with the labelled "Notices, staff messages, call requests and meeting invitations arrive in Release 7" state and the existing privacy note; no counts, badges or sample items | `app/(app)/(tabs)/_layout.tsx`, `app/(app)/(tabs)/inbox.tsx` (replaces `notifications.tsx`), `features/shell/InboxScreen.tsx` (replaces `NotificationsScreen.tsx`), `components/Icon.tsx` (an `inbox` icon), `features/shell/SettingsScreen.tsx` (wording) |
| 7 | **Dashboard demo data (owner decision, Phase 1.0 review):** synthetic, outpatient-only figures and tasks per role live in the development-only `features/dev/demo-dashboard.ts`; `features/dashboard/dashboard-content.ts` is the single entry point and returns them **only** for a demo session in a development build, and Home renders each block under a **DEMO DATA** label. Production builds and server-issued sessions get an honest empty state until the API serves figures (phase 1.11). The invented "All systems operational" chip is removed. The old `demo-data.ts` is deleted. ESLint blocks sample-data imports in workflow screens and lets only `dashboard-content.ts` reach the demo dashboard | `eslint.config.js`, `features/dashboard/HomeScreen.tsx`, `features/dashboard/dashboard-content.ts` (new), `features/dev/demo-dashboard.ts` (new), `features/dashboard/demo-data.ts` (deleted) |
| 8 | Tests: F0-1 to F0-7 (F0-1 reads the grid from `docs/MOBILE-ROLE-MODULE-MATRIX.md`, so the code and the document can't drift); update the navigation tests for the Inbox tab | `features/access/__tests__/`, `features/dev/__tests__/`, `__tests__/navigation.test.tsx` |
| 9 | Documentation: mobile README (roles, Inbox, how to preview roles), roadmap status | `apps/mobile/README.md`, this file |

**Module visibility (display only).**

| Module | Visible with any of | Release with screens |
|---|---|---|
| Reception and scheduling | `appointment:book`, `appointment:read_all` | R1 |
| Clinical (consultations) | `encounter:write` | R1 |
| Nursing (My patients today) | role NUR or SA | R1 |
| Pharmacy | `prescription:dispense`, `operations:oversee` | R1 (stock R4) |
| Laboratory | `lab:process`, `lab_result:verify`, `operations:oversee` | R1 |
| Billing | `invoice:read` | R1 (corrections R3) |
| Administration | `user:manage`, `user_role:assign`, `department:manage`, `audit:read`, `nurse_assignment:manage`, `schedule:manage` | R1 (nurse assignments, minimal staff accounts), R2 |
| Finance | `report:finance`, `expense:create`, `credit_note:create` | R3 |
| Inventory | `stock:adjust_store`, `po:create`, `po:approve`, `equipment:manage` | R4 |
| HR | `employee:read`, `user:create`, `leave:approve` | R5 (staff logins R1) |
| Outreach | `enquiry:manage`, `campaign:manage`, `report:marketing` | R6 |

With these rules: REC sees Reception, Billing and Outreach; DOC sees Clinical; NUR sees Nursing;
PHA sees Pharmacy and Billing; LAB sees Laboratory; FIN sees Billing and Finance; HR sees HR;
INV sees Inventory; MKT sees Outreach; ADM sees Reception, Billing, Administration, Finance,
Inventory, HR and Outreach; SA sees everything. A test asserts this table (F0-3).

**Android verification.** Needs Android Studio (installed by the owner; it is not a project
dependency). Checklist on an emulator (360 × 640 dp and 411 × 891 dp) and, where possible, on a
physical phone through Expo Go: all five tabs open; Inbox shows the placeholder; sign-out
confirm and cancel; role preview switches all 11 roles and Home modules follow the table; permission-denied
and unknown-module states; Android back closes dialogs first and returns to Home from any tab;
TalkBack names every tab; text at 200%. Results are reported only for checks actually run.

**Dependencies.** None in code. Android Studio for the device checks.

**Acceptance.** F0-1 to F0-7 pass; typecheck, lint, format, Jest and `npx expo-doctor` pass; the
Android checklist is completed or each skipped item is reported with its reason; no visual change
apart from the Inbox tab; owner approval.

**Release 1 gate:** the journey in [workflows §2](MOBILE-WORKFLOWS.md#2-the-outpatient-patient-journey)
completed by seeded synthetic users of each role on Android, every list and figure served by the
API, all criteria above passing, and the owner's approval of screenshots and the device report.

## 4. Later releases

Each release is split into phases the same way when its plan is written.

| Release | Delivers | Depends on | Acceptance criteria |
|---|---|---|---|
| **R2 Administration and governance** | HR adds staff and logins; SA assigns roles and edits role permissions (never own); ADM disables, enables, resets passwords; last-SA protection on every path; departments, locations, doctor profiles, schedules (conflicts listed), leave blocks, fees; settings by permission; audit viewer; emergency access and its review queue; **My Devices**; HR sets work emails; **end-of-day job** (scheduled and manual, reconciliation report, integrity checks, catch-up and recovery; an addition beyond the built reference, workflows §6); **design (not build) of document export and sharing**: who may export what, file handling, `document_shares` audit | R1 | AD-1 to AD-8, SC-2, AX-4 to AX-6, AX-10, MA-15, MA-16, JB-1 to JB-10; document export design approved or explicitly deferred |
| **R3 Finance and billing corrections** | The **complete** credit-note creation, correction approval (resolution) and rejection, and refund workflows (MD-22): **Finance resolves billing corrections** (credit note) or **rejects** them (mandatory reason), by FIN or SA, never the initiator; manual credit notes; payment reversal; refunds (request → approval by someone else → paid); void and discard draft; discounts and approvals; price list, GST rate and SAC/HSN, GSTIN fixed at issue; expenses with approval; finance summary; lab test and price management; approvals list; **document export and sharing** for invoices, receipts, credit notes and lab reports **only if its R2 design is approved** | R1 (billing), R2 (settings) | MB-6, MB-7, MB-9, BL-5 to BL-7, BL-11 (amended: credit notes only through the Finance workflow, by `credit_note:create` holders), BL-12, DS-1 to DS-6; DX-1 to DX-3 if export ships; self-approval refused in service and database |
| **R4 Pharmacy stock and inventory** | Dispense returns (draft recalculated, or billing correction with origin `dispense_return`); pharmacy and store adjustments; transfers; medicine catalogue and cold-chain flag; suppliers; purchase orders with approval, reorder suggestions, in-app view (printable copy only with document sharing); goods receipts against orders; movement history, low stock; equipment and maintenance | R1, R3 | DP-5, DP-9, DP-11 (billing effect per MD-11), MB-8, ST-1 to ST-12; transfer reconciliation after every stock test |
| **R5 HR** | Staff records and employment status (exited disables login); attendance; leave requests and HR decisions (doctor leave blocks schedule); HR discount approval from the waiting list. `payroll:manage` stays granted and tested, with no payroll screens (future enhancement) | R2, R3 | Leave decided only by HR; HR sees no bill or chart (L10); exited employee's sessions revoked |
| **R6 Outreach and analytics** | Enquiries, follow-ups, conversion; referral sources; campaigns; consents; aggregate conversion report; hospital statistics; patients per doctor; doctor earnings; my earnings | R1, R3 | MKT never receives patient data (AX-9); every figure from a query (DB-1) |
| **R7 Messaging and notices** | Inbox content: notices, staff messages (1-to-1, groups up to 30), call requests with doctor availability, meeting invitations (shown from R8); REST for sending; **Server-Sent Events** live updates (`expo/fetch` streaming, spike first); push notifications with **user preferences** and private lock-screen text (development build); offline read cache with last-sync labels | R2 | RT-1 to RT-3; non-members get 404; messages append-only; call request expires after 10 min; offline writes blocked; no WebSocket layer |
| **R8 Video meetings** | LiveKit server (ports 7890–7892) and TURN; instant, emergency and scheduled meetings; invite people, roles and Staff heads; mute, camera, meeting chat; host ends or cancels; then locked-phone ringing (ConnectionService, CallKit) | R7 | Only invitees join (404 otherwise); pass valid 5 min for one room; scheduled meeting opens 10 min early and is missed after 2 h; works on two physical phones on different networks |
| **R9 Production hardening and release** | Security and quality audit; backup and restore drill; production hosting and TLS; production email provider; operational monitoring (uptime, error reporting with redaction, log retention, alerts); Android release build and store listing; iOS validation on simulator and device | R1–R8 (an earlier internal release is possible if the owner wants) | No high or critical findings; restore tested; monitoring alerts tested; privacy disclosures written; owner go/no-go |

**Potential future enhancements** (outside feature parity, each needing separate requirements and
approval; never presented as reference functionality): inpatient care, insurance and TPA, imaging,
SMS or WhatsApp, payroll, shift rosters, nursing notes and care tasks, current-medication records,
attachments, ABDM, patient portal, record merging, multiple hospitals, call recording, biometric
unlock, offline writes ([scope §7](MOBILE-PRODUCT-SCOPE.md#7-potential-future-enhancements)).

## 5. Status

| Item | Status |
|---|---|
| Expo foundation, engineering baseline, design system, navigation shell (former steps 1–5) | Done; committed `b4dbe8d`; Android device check pending |
| Planning documents (this set) | Revised draft, awaiting owner review |
| Phase 1.0 | **Implemented on branch `phase/1.0-mobile-alignment`, uncommitted, awaiting owner review** (2026-11-05). Automated checks pass; Android emulator and physical-device checks **not run** (no Android SDK on this Mac): see U1 |
| Phase 1.0 merge | Merged into `main` on GitHub (PR #3, merge commit `c7e8910`, 2026-11-05) |
| Phase 1.1 | **Approved by the owner** (2026-11-06); pushed to `phase/1.1-backend-foundation`, not merged. Not approved for production patient data or release (KI-1, KI-12). Originally completed locally on branch `phase/1.1-backend-foundation`: API, isolated PostgreSQL 17 container, `hospitalos_dev` and `hospitalos_test`, `hos_owner` and `hos_app`, migration 0000 in both, database tests and CI workflow. Final changes uncommitted. See the build log |
| Phase 1.2 first task | Incoming-link guard (AD-M-017), approved 2026-11-06; must land before any external-link feature |
| Expo patch and `zod` override | Deferred to 2026-11-19 under the package-age policy (KI-9, KI-12) |
| Phases 1.2 to 1.12, R2 to R9 | Planned |

## 6. Packages expected to need approval

Listed so nothing is installed by surprise. Each is approved in its phase's plan; Expo modules are
installed with `npx expo install`.

| Phase | Packages |
|---|---|
| 1.1 | `express`, `zod`, `drizzle-orm`, `pg`, `drizzle-kit`, `pino`, `helmet`, `express-rate-limit`, an OpenAPI generator for Zod schemas, `vitest`, `supertest`, `tsx` |
| 1.2 | `@node-rs/argon2`, `nodemailer`; mobile `expo-secure-store`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers` |
| 1.8 | `expo-camera` |
| Document sharing (R3 at the earliest, if approved) | `expo-print`, `expo-sharing` |
| 1.10 | `node-cron` |
| R7 | `expo-notifications`, `expo-dev-client` (SSE uses the installed `expo` package's streaming `fetch`; no WebSocket library) |
| R8 | `livekit-server-sdk`, `@livekit/react-native`, `@livekit/react-native-webrtc`, `@config-plugins/react-native-webrtc` |
| R9 | Mobile end-to-end runner (Maestro, installed outside the project); monitoring/error-reporting SDK if chosen |

## 7. Decision log

All decided by the owner on 2026-11-05.

| ID | Decision | Where it applies |
|---|---|---|
| MD-1, MD-2, MD-3 | Expo app; independent Express 5 / Node.js 24 / TypeScript / Zod / Drizzle / PostgreSQL 17 backend and database in this repository; never connect to the reference | Architecture §1–4 |
| MD-4, MD-9 | Release order R1 to R9; nothing from the reference dropped | Roadmap §3–4 |
| MD-5 | Opaque tokens, 15-min access, rotating refresh with reuse detection, 30-min idle, 12-h absolute | Architecture §5 |
| MD-6 | Home, Work Queue, Search, Inbox, Profile | Matrix §7 |
| MD-7 | 11 roles, 88 permissions, reference rules | Matrix §3–4 |
| MD-8 | One hospital, synthetic data, Android first | Scope §2 |
| MD-10 | Nurse assignment to a doctor session on a date, in R1; no nursing notes or tasks | Workflows §3, roadmap 1.6 |
| MD-11, MD-16 (D3) | No automatic credit notes; draft recalculation; issued invoices never rewritten; payments never above the valid outstanding balance; returns use the same approach; rejection with reason, immutable and non-destructive; all transitions transactional and tested | Workflows §4 |
| MD-12 | Backend owns all data; seeds in PostgreSQL | Architecture §6 |
| MD-13 | Local isolation: own Compose project, network, volumes, databases, users, ports 4000 / 5433, environment files and secrets | Architecture §7 |
| MD-14 (D1) | FIN and SA keep `credit_note:create`; Finance workflow only; separation of duties from the initiating cancellation | Workflows §4, matrix §6 |
| MD-15 (D2) | R1 documents viewed in the app only; export and sharing designed later and approved separately | Scope §5.19, architecture §8 |
| MD-17 (D4) | Reset code: 8 digits, 15 min, 5 attempts, 3 per account and 10 per IP per hour, keyed hash, generic responses, configurable, boundary-tested | Architecture §5.4, §5.6 |
| MD-18 (D5) | REST + Server-Sent Events as in the reference; push in R7 with preferences; LiveKit in R8; no WebSocket without a documented need | Architecture §9–10 |
| MD-19 (D6) | My Devices (R2); app-version check with minimum-version enforcement (R1); document-sharing audit with document sharing | Architecture §5.3, §6.2; scope §5.19 |
| MD-20 | Roles and 88 permissions seeded everywhere; no default or shared passwords; audited SA bootstrap; other accounts by authorized administration; demo accounts only in development and test with disposable credentials | Architecture §6.3 |
| MD-21 | End-of-day job is an addition beyond the built reference, delivered in R2, not blocking the R1 pilot | Workflows §6 |
| MD-22 | Release 1 billing scope; complete credit-note, approval, rejection and refund workflows in R3; SA and FIN as in the matrix | Scope §4 |
| D1 (1.1) | One canonical shared package, `packages/contracts` (roles, 88 permissions, schemas, validation contracts, common types); no `packages/shared`; the backend alone decides authorization | Architecture §2, ARCHITECTURE-DECISIONS.md AD-M-009 |
| D2 (1.1) | End-of-day job in Release 2 as an addition beyond the built reference; its rules are reviewed before R2 | Workflows §6, ARCHITECTURE-DECISIONS.md AD-M-010 |
| MD-23 | Minimal staff-account administration in R1 (O7 approved with Phase 1.0) | Architecture §6.3, roadmap 1.2b |
| — | Out of feature parity: inpatient care, insurance, imaging, SMS, payroll, shift rosters, nursing notes and care tasks, and the other items in scope §7 | Scope §7 |

**Dropped:** the extra per-hour verification limits proposed in the previous review (not part of
D4); M-ADR-3's WebSocket proposal (replaced by Server-Sent Events, D5).

## 8. Remaining open decisions

None blocks Phase 1.0. Each is raised in the plan of the phase that needs it.

| # | Decision | Needed before |
|---|---|---|
| O1 | Document export and sharing design (authorization, files, audit) | R2 (design), R3 (build) |
| O2 | Whether emergency-meeting alerts can be turned off in push preferences | R7 planning |
| O3 | Production host, managed PostgreSQL, domain and TLS | R9 planning (earlier if an internal pilot is wanted) |
| O4 | Production email provider for reset codes | R9 planning |
| O5 | Operational monitoring: uptime checks, error reporting service (with redaction), log retention, alerting | R9 planning |
| O6 | Whether to block screenshots on sensitive screens (Android `FLAG_SECURE`, needs a package) | Phase 1.12 |
| O7 | ~~Minimal account administration in Release 1~~ **Closed:** approved with Phase 1.0 as MD-23 (phase 1.2b) | — |

## 9. Reconciled issues

| # | Issue | Resolution |
|---|---|---|
| U1 | **Android emulator and physical-device verification** not done. No Android emulator or phone test has ever been run for this project: every result so far comes from Jest, run on this Mac with the default (iOS) preset. No Android SDK, emulator or `adb` is installed here | Prerequisite of Phase 1.0: install Android Studio with an emulator image; the existing shell is checked on the emulator and a physical phone before 1.0 is signed off; every release gate repeats the device checklist (test strategy §9) |
| U2 | **Docker network and volume isolation** not verified live (Docker not running) | ISO-0 is the first step of phase 1.1, with Docker running, before any database is created; the result goes in the phase report |
| U3 | **No root `.gitignore`**: a future `apps/api/.env` would not be ignored | Phase 1.1 adds root ignore rules for `apps/api/.env` and `.env.*` (except `.env.example`) before the file exists; ISO-4 checks it with `git check-ignore`; the secret scanner runs in CI |
| U4 | **Work-email dependency** for password reset | R1: every seeded synthetic account has a synthetic work email (local Mailpit only); an audited command-line reset covers accounts without one. R2: HR sets work emails, administrators reset passwords in the app (as in the reference) |
| U5 | **GST and tax** | Invoice lines have tax columns from phase 1.9, every rate 0%; configuration (rates, SAC/HSN, GSTIN at issue) in R3, as in the reference |
| U6 | **Jest and React Native compatibility**: `jest-expo/android` preset fails to load in SDK 57 | Mobile Jest keeps the default preset; platform-specific code paths are tested by mocking `Platform.OS`; Android behaviour is proven on the emulator and in end-to-end runs; the preset is re-checked at each Expo SDK update |
| U7 | **Production hosting, email provider, operational monitoring** | Open decisions O3 to O5, decided in R9 planning; nothing contacts an outside service before then without approval |
| U8 | No discounts in R1 | Accepted: they arrive in R3 with the approval workflow |
| U9 | `docs/ROADMAP.md` and `docs/IMPLEMENTATION-PLAN.md` are older plans | Kept unchanged for now (owner instruction); marked superseded only when the owner says so |
| U10 | End-of-day job was marked "built in the reference" in an earlier draft | Corrected: designed but not built there; now an R2 addition (MD-21) |

## 10. Risks

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| K1 | No Android SDK on the development Mac, so device checks lag behind code | High / medium | Android Studio is a Phase 1.0 prerequisite; no release gate passes without a device report |
| K2 | Expo Go on the owner's phone may not match SDK 57 | Medium / low | Use a development build if Expo Go is incompatible; documented in the mobile README |
| K3 | Reference documents disagree in places (for example `requirements.md` says SA has no patient data, later superseded) | Medium / medium | The reference **code** and the newest owner decision win; each disagreement is noted where it matters |
| K4 | Account creation in R1 depends on phase 1.2b being finished before a pilot | Low / high for a pilot | Phase 1.2b sits directly after 1.2 (MD-23) |
| K5 | Billing corrections stay open until R3, so some invoices can't be fully settled in an R1 pilot | Medium / medium | Visible correction list for FIN/ADM/SA; R3 follows R2 directly |
| K6 | Scope is large (9 releases); later releases may slip | High / medium | Strict phase gates; each release usable on its own |
| K7 | `jest-expo/android` preset broken | Known / low | Platform mocking plus emulator and end-to-end runs (U6) |
| K8 | Docker resources could collide with the reference project | Low / high | ISO-0 with Docker running before any database exists; start-up guards on database name and user |
| K9 | Monorepo move (npm workspaces) could disturb the working Expo setup | Medium / medium | Done alone in phase 1.1 with Expo Doctor and a device smoke test before anything else is added |
