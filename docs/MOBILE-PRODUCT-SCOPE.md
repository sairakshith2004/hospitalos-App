# HospitalOS Mobile: product scope

Status: **final draft for owner review**, 2026-11-05 (all owner decisions of 2026-11-05 applied,
including D1 to D6 and the Release 1 corrections MD-20 to MD-23).
Nothing in this document is built yet unless it says so.

Related: [role and module matrix](MOBILE-ROLE-MODULE-MATRIX.md) · [workflows](MOBILE-WORKFLOWS.md) ·
[architecture](MOBILE-ARCHITECTURE.md) · [roadmap](MOBILE-IMPLEMENTATION-ROADMAP.md) ·
[test strategy](MOBILE-TEST-STRATEGY.md)

## 1. What we are building

HospitalOS Mobile is the **complete HospitalOS product** as an Android-first, iOS-compatible app for
one multispecialty outpatient hospital. Every staff member of all 11 roles signs in on their phone
and does their own work on one shared patient record: reception, doctors, nurses, pharmacy,
laboratory, billing, finance, inventory, HR, administration, outreach and hospital leadership.

It is delivered in releases. Release 1 is the integrated outpatient patient journey. Every other
module of the reference follows in later releases; none is dropped (section 5).

## 2. Approved decisions (owner, 2026-11-05)

| ID | Decision |
|---|---|
| MD-1 | Repository `hospitalos-App` only. Mobile app: Expo + React Native + TypeScript (Expo SDK 57). |
| MD-2 | Independent backend inside this repository: Node.js 24, Express 5, TypeScript, Zod, Drizzle ORM, PostgreSQL 17. Follows the reference architecture. |
| MD-3 | Independent database. The existing web application's backend and database are never connected to or modified. |
| MD-4 | Release 1 is the complete integrated outpatient journey (section 4). |
| MD-5 | Sign-in uses server-generated opaque access tokens and rotating refresh tokens (no cookies, no JWTs). Forgot password uses a one-time code sent to the work email. Details: [architecture §5](MOBILE-ARCHITECTURE.md#5-authentication-and-sessions). |
| MD-6 | Bottom navigation: Home, Work Queue, Search, Inbox, Profile. Inbox holds notices, messages, call requests and meeting invitations, filtered by permission. |
| MD-7 | All 11 roles, all 88 permissions and the documented business rules are kept as the requirements. |
| MD-8 | One hospital. Synthetic data only. Android first; iOS from the same code. |
| MD-9 | Release order R1 to R9 as in section 4 and the roadmap. No role, permission or reference module is dropped. |
| MD-10 | Nurse assignment management is in R1. Nurses get only what their role and assignment allow; no nursing notes or care tasks. |
| MD-11 | **No automatic credit notes.** Cancelled or unperformed services are never charged: a draft invoice is recalculated; an issued invoice is never changed silently, and its correction goes through the controlled Finance workflow (R3). Every financial correction keeps its audit history. Details: [workflows §4](MOBILE-WORKFLOWS.md#4-billing-corrections-when-a-service-is-cancelled). |
| MD-12 | **The backend owns all data.** Synthetic seed data lives in the independent PostgreSQL database and reaches the app only through the API. No hard-coded app arrays are a source of truth for integrated workflows. |
| MD-13 | Local development is fully isolated from the reference project: own databases, database users, Compose project, network, volumes, ports (API 4000, PostgreSQL 5433) and secrets ([architecture §7](MOBILE-ARCHITECTURE.md#7-environments-and-local-isolation)). |
| MD-14 | **Credit notes (D1):** FIN and SA both keep `credit_note:create` (SA holds all 88 permissions; the reference matrix is unchanged). Both use only the controlled Finance correction workflow. Nobody creates, resolves or rejects a correction arising from their own cancellation; every correction is attributable and audited. |
| MD-15 | **Documents (D2):** in Release 1 receipts and lab reports are viewed securely inside the app only. PDF export, the system share sheet and any document sharing are deferred until their authorization, privacy and audit design is approved (section 5.19). |
| MD-16 | **Correction safeguards (D3):** payments never exceed the valid outstanding balance; a pending cancellation's amount can't be collected; medicine returns (R4) use the same correction approach; credit-note holders may reject a pending correction only with a mandatory reason, as an immutable audit event that can't erase an issued invoice, a credit note or a refund already due; every financial transition is transactional and tested. |
| MD-17 | **Password reset (D4):** 8-digit cryptographically random code, 15 minutes, 5 verification attempts per code, at most 3 requests per account and 10 per source IP per hour, keyed hash only, generic responses. Limits configurable within these bounds, with boundary tests. |
| MD-18 | **Real time (D5):** REST for sending messages and all business operations; Server-Sent Events for authenticated live updates, as in the reference; push notifications in R7 with user preferences and privacy-safe lock-screen text; LiveKit for video in R8. No WebSocket layer unless a documented requirement shows REST and SSE are insufficient. |
| MD-19 | **Additions (D6):** My Devices (R2); app-version check with minimum-version enforcement (R1); document-sharing audit when sharing is introduced. |
| MD-20 | **Seeds and accounts:** every environment is seeded with the 11 roles and exactly 88 permissions. No environment gets staff accounts with default or shared passwords. The first Super Admin is created by a secure, audited bootstrap; every other account through authorized administration. Demo accounts exist only in isolated development and test databases, with disposable credentials. |
| MD-21 | **End-of-day job** is an addition beyond the built reference (designed there, never built). It is specified fully (workflows §6) and delivered in R2; it does not block the Release 1 pilot, because no R1 rule depends on it (time-based states are computed when read). |
| MD-22 | **Release 1 billing scope:** draft invoices with consultation, pharmacy and lab charges, payments and in-app receipts; cancelled services never collected; drafts recalculated; issued invoices never rewritten; a pending correction recorded when needed. Credit-note creation, correction approval and rejection, and refunds are delivered complete in R3, with SA and FIN permissions exactly as in the 88-permission matrix. |
| MD-23 | **Minimal staff-account administration in Release 1** (decision O7, approved with Phase 1.0): HR creates a staff login with a temporary password the person must change at first sign-in; SA assigns and revokes roles (never their own; last active SA protected); ADM or SA disables and re-enables accounts (not SA accounts for ADM, never their own). Every change needs a reason and is audited. The rest of account management stays in R2. |

## 3. Reference and principles

**Reference product.** The HospitalOS web application (`hospital-management-system`), read on
2026-11-05: its README, `docs/requirements.md`, `docs/architecture.md`, `docs/erd.md`,
`docs/permissions.md`, `docs/state-machines.md`, `docs/roadmap-after-mvp.md`, the ADRs and
`packages/shared/src/permissions.ts`. We copy its **rules**, not its code, and we never connect to
it. Acceptance-criteria IDs from the reference (PR-1, BK-2, DP-7 and so on) are reused unchanged so
the two products can be compared rule by rule.

**Principles (inherited from the reference, plus mobile ones).**

| Principle | In practice |
|---|---|
| The server decides | The app hides what a role can't use, but the API checks the permission and the record-level rule on every request. |
| One patient record | Registered once, used by every department. Work flows between departments automatically. |
| Nothing clinical or financial is deleted | Corrections are new records (addenda, credit notes, reversals, amendments). |
| Every sensitive action is audited | In the same transaction; a clinical read fails if its audit row can't be written. |
| No clinical decision support | No diagnosis, treatment, dose or result interpretation. Allergy matches, equivalence checks and reference-range flags are factual comparisons only. |
| Synthetic data only | No real patient, staff or financial data in seeds, tests, screenshots or logs. |
| The backend owns the data | Schedules, catalogues, prices, accounts, patients and every operational record come from the database through the API, from the first integrated phase. |
| Never invent content | No placeholder figures, fake messages or fake notifications. A feature that isn't built yet shows a clear "coming in Release N" state. |
| Mobile-safe by default | Nothing sensitive in push notification text, logs or crash reports; no offline writes for clinical, stock or money actions; credentials only in secure storage. |
| Usable first | Premium visual design, but readability, accessibility (contrast, text scaling, screen readers, touch targets, reduced motion) and performance on mid-range Android come first. |

## 4. Release 1: the integrated outpatient journey

Release 1 is done when a patient can go through this journey on Android with synthetic data, every
role involved doing its part on its own phone, and all of the reference's rules for these steps
holding (end-to-end scenario in [workflows §2](MOBILE-WORKFLOWS.md#2-the-outpatient-patient-journey)):

register → book or walk in → check in (bill starts) → nurse vitals → consultation → prescription
and lab order → dispensing and lab verification → invoice issued → payment and receipt → follow-up
booked.

**Roles that work in Release 1:** Super Admin, Receptionist, Doctor, Nurse, Pharmacist, Lab
Technician, and Finance and the Hospital Administrator for the billing and oversight parts they need
(viewing invoices and pending corrections; assigning nurses). The other roles can sign in and
see an honest "your workspace arrives in Release N" state.

**Accounts in Release 1 (MD-20).** The 11 roles and 88 permissions are seeded in every
environment. The first Super Admin is created with the audited bootstrap command. Development and
test databases also get demo accounts for every role, with credentials generated randomly at seed
time and never committed; no other environment ever gets them. Creating real staff accounts needs
authorized administration: a minimal version is in R1 (MD-23: HR creates a login, SA assigns roles,
ADM disables), so a pilot can run outside development; the rest of account management is R2.

**Data Release 1 relies on but doesn't let users edit yet.** Departments, doctor profiles,
schedules, fees, the medicine catalogue and batches, the lab test catalogue and prices are
**synthetic records seeded into the PostgreSQL database** and read by the app through the API,
exactly like data entered later through management screens (MD-12). The screens to manage them
arrive in Releases 2 to 5. Nothing the journey uses is hard-coded in the app.

**Billing in Release 1** (MD-22) is basic billing: consultation, pharmacy and lab charges added
automatically to the visit's draft invoice, issue, payments, receipts viewed in the app. A
cancelled service is removed from a draft invoice and the draft recalculated. If its invoice was already issued, the invoice is not changed: a billing
correction is opened for Finance, and payments can't collect the cancelled amount while it is open
(MD-11, MD-16). Credit notes, correction approval and rejection, and refunds are delivered complete
in R3 (MD-14, MD-22).

**Password reset needs a work email.** A forgotten password can be reset by code only for accounts
with a work email on file. In R1 the demo accounts in development and test have synthetic work
emails (delivered to the local Mailpit only), and the bootstrap asks for the first Super Admin's
work email. Anyone without one uses the audited command-line reset, run by an operator with database
owner credentials. From R2, HR sets work emails and administrators reset passwords in the app (HR
enters a work email when creating a login from R1).

**Not on the Release 1 critical path.** The end-of-day job (MD-21) is delivered in R2. Release 1
computes time-based states when they are read instead: past appointments still `booked` show as
"did not arrive" until reception marks them, overdue follow-ups are computed, and prescription
validity is checked at dispensing.

**Releases.** R1 integrated outpatient journey · R2 administration and governance · R3 finance and
billing corrections · R4 pharmacy stock and inventory · R5 HR · R6 outreach and analytics ·
R7 messaging and notices · R8 video meetings · R9 production hardening and release.

## 5. Feature status

Legend:

- **Reference**: `Built` = works in the web reference (README sections 2 and 9); `Designed` = in the
  reference's design documents but not built there; `—` = not in the reference.
- **Mobile**: `R1` to `R9` = the mobile release that delivers it (roadmap); `Future` = a potential
  future enhancement outside feature parity, needing separate requirements and approval
  (section 7). `Future` never means the reference has it.

### 5.1 Authentication and account lifecycle

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Sign in with username and password; generic failure message | Built | R1 | Mobile uses tokens, not cookies (architecture §5) |
| Sign out (this device) | Built | R1 | Revokes the session on the server |
| Session idle (30 min) and absolute (12 h) limits | Built | R1 | Configurable security settings |
| Account disabled or role removed takes effect on the next request | Built | R1 | Permissions re-read on every request |
| Lockout: 5 failures per account per IP for 15 minutes; rate limits | Built | R1 | Same rules |
| Forced own-password choice after HR or admin set one | Built | R1 | `403 PASSWORD_CHANGE_REQUIRED` until done |
| Change own password (other sessions end) | Built | R1 | |
| Forgot password | Built (emailed link) | R1 (emailed one-time code) | MD-17: 8 digits, 15 minutes, 5 attempts per code, keyed hash only, at most 3 requests per account and 10 per IP per hour; configurable within those bounds (architecture §5.6). Needs a work email on file (section 4) |
| Refresh-token rotation, reuse detection, family revocation | — | R1 | New for mobile |
| List and sign out my other devices | — | R2 | New for mobile; needed once people use several phones |
| Secure first Super Admin bootstrap (command line, only while no SA exists, audited) | Built (`db:bootstrap-admin`) | R1 (phase 1.2) | MD-20; ACC-1, ACC-2 |
| Demo accounts with disposable credentials, development and test databases only | — | R1 (phase 1.2) | MD-20; ACC-3, ACC-4 |
| HR adds staff and creates their login (temporary password, forced change) | Built | R1 (phase 1.2b, MD-23) | ACC-6 |
| Super Admin assigns and revokes roles; account with no roles sees nothing | Built | R1 (phase 1.2b, MD-23) | Roles and permissions themselves are seeded everywhere; AD-3, AD-4, AD-8 |
| Admin disables and re-enables accounts (not SA accounts) | Built | R1 (phase 1.2b, MD-23) | AD-2 (part) |
| Admin resets passwords; HR sets work emails | Built | R2 | |
| Last active Super Admin protected by every path | Built | R2 | Enforced in the API from R1 |
| My Devices: list my active sessions and revoke one | — | R2 | MD-19; MA-15, MA-16 |
| App-version check and minimum-version enforcement | — | R1 (phase 1.2) | MD-19; AV-1 to AV-4 |
| Biometric app unlock | — | Future | Never replaces the password |

### 5.2 Patients and records

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Register patient with automatic MRN (`MRN000123`) | Built | R1 | PR-1 |
| Duplicate warning (same phone and date of birth); no automatic merge | Built | R1 | PR-2 |
| Search by MRN, phone or name (fuzzy, max 20 rows) | Built | R1 | MRN accepts `MRN000123`, `mrn 123` or `123` |
| Edit demographics (audited field names) | Built | R1 | PR-4, optimistic locking |
| Patient chart: visits, vitals, diagnoses, notes, prescriptions, lab results, allergies | Built | R1 | Care-based access only |
| Allergies (recorded by doctor or assigned nurse) | Built | R1 | |
| Medical history entries | Designed | R1 | `history:write` exists; doctor only |
| Department lookup by patient number (pharmacy, lab, billing) | Built | R1 | Identifiers plus that department's records |
| Contacts and consents | Designed | R6 | Marketing consent; reminders need a provider |
| Current medications | Designed (not recorded) | Future | Reference lists it as not built |
| Patient documents and uploads | Designed | Future | Needs private file storage decision |
| Patient record merging | — (deferred) | Future | |

### 5.3 Reception and appointments

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Doctor directory and live availability | Built | R1 | SC-1 |
| Book, reschedule (one transaction), cancel with reason | Built | R1 | BK-1 to BK-5 |
| Concurrent bookings of one slot: exactly one succeeds | Built | R1 | BK-2; database constraint |
| Walk-ins with gap-free tokens | Built | R1 | QU-3 |
| Check-in: token plus consultation fee on draft invoice, same transaction | Built | R1 | QU-1, CF-1, CF-2 |
| Queue per doctor with waiting time | Built | R1 | QU-2 |
| No-show marked by reception | Built | R1 | Past `booked` appointments are shown as "did not arrive" (computed) until marked |
| Automatic no-show at end of day | Designed, not built | R2 (end-of-day job) | JB-1; MD-21 |
| Day list for every doctor (reception, admin) | Built | R1 | `appointment:read_all` |
| Follow-ups to book (pending, due, overdue) | Built | R1 | FU-1 to FU-4 |
| Patients per doctor report | Built | R6 | |

### 5.4 Doctor consultations and clinical records

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| My appointments (today, 7 days) and my queue | Built | R1 | |
| Start consultation from a checked-in patient | Built | R1 | |
| Vitals (°C or °F), symptoms, observations, plan notes | Built | R1 | CN-1 |
| Diagnoses (clinician-entered text and code) | Built | R1 | No suggestions |
| Edit while in progress (audited); addenda only after completion | Built | R1 | CN-2 |
| Entered in error (returns patient to queue) | Built | R1 | CN-3 |
| Prescriptions with allergy acknowledgement and "substitution allowed" | Built | R1 | RX-4 |
| Medicine availability search (read-only) | Built | R1 | RX-1 to RX-3 |
| Lab orders and results in the chart | Built | R1 | Cancelling an order follows MD-11 |
| Recommend follow-up | Built | R1 | |
| Care-based chart access (7 days before, 90 days after) | Built | R1 | AX-1 to AX-3, AX-12 |
| Other doctors' reports on request (audited) | Built | R1 | |
| Emergency (break-glass) access, read-only 4 hours, reviewed | Built | R2 | AX-4 to AX-6, AX-10; review screen in R2 |
| My earnings | Built | R6 | |

### 5.5 Nursing

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Nurse assignment to a doctor session on a date (ADM, SA), up to 30 days ahead; revocable | Built | R1 | MD-10; the nurse sees that session's patients once checked in; AX-13 |
| My patients today (assigned, checked-in patients only) | Built | R1 | AX-7 |
| Record vitals before the consultation | Built | R1 | QU-4 |
| Record allergies | Built | R1 | |
| Read the assigned patients' charts | Built | R1 | |
| Medicine search | Built | R1 | |
| Ask a doctor for a call | Built | R7 | |
| Nursing notes, care tasks, handoffs | — (not in the reference) | Future | Nurses have no note or task permission in the reference |

### 5.6 Pharmacy and dispensing

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Prescription queue with the patient's allergies | Built | R1 | |
| First-expiry-first-out dispensing, partial dispensing | Built | R1 | DP-1, DP-4 |
| Expiry rules (expired, before course end, near-expiry acknowledgement, recalled) | Built | R1 | EX-1 to EX-5 |
| Stock, prescription and invoice change together; idempotent | Built | R1 | DP-2, DP-3, DP-7 |
| Verified substitution where the doctor allowed it | Built | R1 | SB-1 to SB-5 |
| Close a partly dispensed prescription | Built | R1 | |
| Prescription validity (30 days) enforced at dispensing time | Designed (setting only; not enforced in the reference code) | R1 | Computed when dispensing, so it needs no end-of-day job |
| Patient lookup by number | Built | R1 | |
| Pharmacy bills and payments | Built | R1 | Basic billing (no corrections) |
| Returns within 7 days, restock only when safe | Built | R4 | DP-5, DP-9, DP-11; draft line recalculated, issued invoice → billing correction (MD-11) |
| Pharmacy stock adjustments | Built | R4 | ST-1 to ST-5 |
| Store ↔ pharmacy transfers, received by another user | Built | R4 | ST-7 to ST-12 |
| Medicine catalogue management, cold-chain flag | Built | R4 | |

### 5.7 Laboratory

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Worklist | Built | R1 | |
| Sample collection with barcode | Built | R1 | Camera scan on the phone |
| Result entry with abnormal flags (factual, against reference range) | Built | R1 | LB-3 |
| Verification by a different technician | Built | R1 | LB-2 |
| Amendment keeps the earlier version | Built | R1 | LB-5 |
| Results in the doctor's chart | Built | R1 | |
| Report viewable in the app only after verification | Designed (Tier 2 PDFs) | R1 (in-app view) | LB-4; PDF export and sharing per section 5.19 |
| Patient lookup by number | Built | R1 | |
| Test catalogue and prices management | Built | R3 | Seeded in R1 |
| Imaging and radiology | — (not built; reference roadmap phase 7) | Future | |

### 5.8 Billing and payments

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| One draft invoice per visit; charges added automatically | Built | R1 | Consultation, lab, medicine |
| Charges after issue go on a new invoice; visit shows all | Built | R1 | |
| Issue invoice (gapless `INV-2026-000001`) | Built | R1 | |
| Payments: cash, card, UPI, bank; part payments; idempotent | Built | R1 | BL-2 to BL-4 |
| Receipts (`RCT-…`) viewed in the app | Built (print view) | R1 (in-app view) | MD-15; export per section 5.19 |
| Cancelled service removed from a draft invoice; draft recalculated | Built | R1 | MB-1 |
| Cancelled service on an issued invoice: invoice unchanged, billing correction opened for Finance, cancelled amount can't be collected | — (reference creates an automatic credit note) | R1 | MB-2 to MB-5; changed by owner decision MD-11 |
| Finance resolves billing corrections (credit note, then refund if paid) | — (reference is automatic) | R3 | MB-6, BL-6, BL-11 as amended; FIN or SA (MD-14), never the person who cancelled |
| Finance rejects a pending correction with a mandatory reason | — | R3 | MB-7; immutable audit event; never erases an issued invoice, credit note or refund due (MD-16) |
| Outstanding balance separate from unbilled charges | Built | R1 | CF-5 |
| Discounts (10% limit, approval above) | Built | R3 | DS-1 to DS-6 |
| Manual credit notes, payment reversal, void, discard draft | Built | R3 | |
| Refunds (request → approval by someone else → paid) | Built | R3 | BL-7 |
| GST rate and SAC/HSN per line, GSTIN fixed at issue | Built | R3 | Rates start at 0% |
| Insurance and TPA | — (not built; reference roadmap phase 5) | Future | |

### 5.9 Inventory and equipment

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Suppliers | Built | R4 | |
| Purchase orders (approved by someone else), reorder suggestions, in-app view | Built | R4 | Printable/shareable copy per section 5.19 |
| Goods receipts against an order, never beyond what was ordered | Built | R4 | ST-6 |
| Store stock, adjustments, movement history, low stock | Built | R4 | |
| Equipment register and maintenance log | Built | R4 | |
| Supplier invoices and payments | — | Future | |

### 5.10 HR and staff administration

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Add staff and create login; work email for reset codes | Built | R2 | Account part of HR, delivered with administration |
| Staff records, employment status (exited disables login) | Built | R5 | |
| Attendance | Built | R5 | |
| Leave: everyone requests, only HR decides; doctor leave blocks schedule | Built | R5 | |
| HR approves discounts (sees only the waiting list) | Built | R5 | Needs R3 discounts |
| Shift rosters | Designed only (reference requirements); not built | Future | Reference roadmap phase 8 |
| Payroll | Designed only: reference requirements mention manual payroll and HR holds `payroll:manage`, but no payroll feature is built | Future | The permission stays in the catalogue, seed and tests; no screens |

### 5.11 Finance

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Read every invoice; finance summary | Built | R3 | Invoice reads available in R1 |
| Price list and GST rates | Built | R3 | |
| Expenses approved by someone else | Built | R3 | |
| Doctor earnings | Built | R6 | |
| Statutory accounting, GST returns, ledger | — | Future | |

### 5.12 Administration and permissions

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Departments and locations | Built | R2 | Seeded in R1 |
| Doctor profiles, weekly schedules, leave and blocked time, fees | Built | R2 | Schedule change lists conflicts (SC-2) |
| Settings split: system and security (SA), operational (ADM) | Built | R2 | AD-7 |
| Audit log viewer (identifiers only) | Built | R2 | AD-5, AD-6 |
| Emergency access review queue | Built | R2 | |
| Nurse assignments | Built | R1 | |
| End-of-day job (scheduled and manual run, reconciliation report) | Designed, not built (reference README: "Not built yet: … end-of-day job") | R2 | MD-21; JB-1 to JB-10; does not block the R1 pilot |
| Role definitions editor | Designed (no editor) | R2 | `role:manage`; SA only, never own roles |
| Approvals inbox (discounts, refunds, POs, expenses) | Built (dashboard) | R3–R4 | Arrives with each approval type |

### 5.13 Marketing and outreach

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Enquiries, follow-ups, conversion to patient | Built | R6 | Reception can create enquiries |
| Referral sources | Built | R6 | |
| Campaigns | Built | R6 | |
| Aggregate conversion report (no patient data) | Built | R6 | |
| SMS or WhatsApp outreach | — (not built; reference roadmap phase 7) | Future | Needs a provider and DLT registration |

### 5.14 Analytics and reports

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Role dashboards from live queries (no placeholder figures) | Built | R1 (journey roles), later releases for the rest | DB-1 |
| Hospital statistics: 12-month patients and revenue, revenue by service | Built | R6 | Charts drawn without a chart library if possible |
| Doctor reports (patients per doctor, earnings) | Built | R6 | |
| Finance reports | Built | R3 | |

### 5.15 Notices and staff messaging

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Inbox tab with a polished, clearly labelled "coming in Release 7" state; no invented items | — | R1 shell, R7 content | MD-6 |
| Official notices (SA, ADM, HR) to all, a role, a department or a person | Built | R7 | |
| Staff messages, 1-to-1 and groups up to 30, append-only | Built | R7 | |
| Live updates while the app is open | Built (Server-Sent Events) | R7 | Server-Sent Events, as in the reference (MD-18, architecture §9) |
| Push notifications with user preferences and privacy-safe lock-screen text | — | R7 | New for mobile (MD-18) |
| Attachments | — | Future | |

### 5.16 Doctor call requests

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Ask a doctor for a call; only that doctor accepts or declines | Built | R7 | Expires after 10 minutes |
| Doctor availability (Available, Busy, Off duty; off duty only for emergencies) | Built | R7 | |

### 5.17 Video meetings

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Instant meetings, invite people or whole roles, "Staff heads" group | Built | R8 | |
| Emergency meetings that ring every invitee full-screen | Built | R8 (app open); later for locked phone | Locked-phone ringing needs native call UI |
| Scheduled meetings (up to 90 days; opens 10 min early; missed after 2 h) | Built | R8 | |
| Video call from any conversation | Built | R8 | |
| Up to 50 people with LiveKit (8 without) | Built | R8 | LiveKit only on mobile |
| Mute, camera, screen share, meeting chat | Built | R8 | Screen share on mobile is a later step |
| Recording | — | Future | |
| TURN relay for calls across networks | Designed, not set up | R8 | Required for phones on mobile data |

### 5.18 Cross-cutting

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Audit log for every sensitive read and write | Built | R1 | |
| Development-only role preview | — | Until phase 1.2 (dev builds only) | Design review only, never authorization; replaced by signing in as seeded synthetic accounts through the API |
| Offline: read-only cached data marked out of date | — | R7 | No offline writes |
| Inpatient care (wards, beds, admission, discharge) | — (not built; reference roadmap phase 4) | Future | |
| ABDM, DPDP compliance review | — | Future | Before any real data |

### 5.19 Documents: viewing, export and sharing

| Feature | Reference | Mobile | Notes |
|---|---|---|---|
| Secure in-app view of receipts, invoices and verified lab reports | Built (browser print view) | R1 | Permission-checked like any screen; nothing written to phone storage |
| PDF export, system share sheet, document sharing | Built as browser printing only | Deferred: designed in R2, delivered in R3 at the earliest, after separate owner approval | MD-15. Its design must cover who may export which document, privacy of files leaving the app, and the audit below |
| Document-sharing audit: actor, document type and ID, time, outcome; never the document's contents | — | With document sharing | MD-19; DX-1 to DX-3 |
| Printable purchase orders for suppliers | Built | With document sharing (R4 at the earliest) | |

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Platforms | Android 10+ phones first (compact 360 × 640 dp to large 411 × 891 dp, plus a 10" tablet check). iOS 17+ validated from the same code before an iOS release. |
| Performance | Screens usable within 1 s on demo data over Wi-Fi on a mid-range Android phone; lists virtualised; blur and animation used sparingly. |
| Accessibility | WCAG AA contrast, system text scaling to 200% without lost content, screen-reader labels and roles, 48 dp touch targets, reduced motion respected. |
| Scale | Around 50 concurrent staff, one API process (several later via shared state). |
| Locale | English; Indian rupees on screen, paise in storage; Asia/Kolkata for "today". |
| Security | TLS in production; credentials only in Android Keystore / iOS Keychain; no patient data in logs, crash reports or notification text. |
| Data | Synthetic only, until legal, clinical and security review. |

## 7. Potential future enhancements

These are **outside feature parity**. None is claimed as existing reference functionality unless
the "Reference status" column says so. Each needs its own requirements, owner approval and a plan
before any work starts.

| Enhancement | Reference status |
|---|---|
| Inpatient care: wards, beds, admission, transfer, medication rounds, discharge, running bill | Not built; deferred in the reference (ADR 0012) and listed as its roadmap phase 4 |
| Insurance and TPA claims | Not built; reference roadmap phase 5 |
| Imaging and radiology | Not built; reference roadmap phase 7 |
| SMS or WhatsApp reminders and outreach | Not built; reference roadmap phase 7 |
| Payroll | Not built; mentioned in reference requirements; the `payroll:manage` permission exists |
| Shift rosters | Not built; mentioned in reference requirements; reference roadmap phase 8 |
| Nursing notes, care tasks, handoffs | Not in the reference at all |
| Current-medication records | Designed in the reference schema, recorded as not built |
| Patient documents and attachments | Designed in the reference schema (metadata only); not built |
| ABDM integration, DPDP compliance work | Not built; reference roadmap phase 9 |
| Patient portal, record merging, multiple hospitals | Deferred in the reference requirements |
| Supplier invoices, statutory accounting, GST returns | Not in the reference |
| Call recording | Not in the reference |
| Biometric app unlock, offline writes | Not in the reference (mobile-only ideas) |
