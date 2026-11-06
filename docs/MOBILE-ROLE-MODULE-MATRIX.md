# HospitalOS Mobile: roles, modules and permissions

Status: **final draft for owner review**, 2026-11-05 (all owner decisions of 2026-11-05 applied,
including D1 to D6 and the Release 1 corrections). The 88-permission grants are unchanged from
the reference; only this product's release column changed (`day_close:run` to R2; `user:create`,
`user_role:assign` and `user:manage` to R1 for minimal account administration, MD-23).

The permission model is the reference's, unchanged: **11 roles and 88 permissions**, a user's
permissions being the union of their roles, re-read on every request. The grid in section 3 was
generated from the reference's `packages/shared/src/permissions.ts` (2026-11-05), not typed by
hand. In this repository the same list lives once in `packages/contracts` (decision D1) and a test fails if
it, this document or the seed ever disagree.

**Where permissions come from at run time.** The signed-in user's permissions are read from the
database on every API request and returned by `GET /v1/auth/me`. The app never derives them from a
role name or a local table (architecture §6.1).

**The app only uses permissions to decide what to show.** The API checks the permission and the
record-level rule on every request. A hidden button is never a security control.

## 1. Roles

| Code | Role | Main responsibilities |
|---|---|---|
| SA | Super Admin (head of the hospital) | Every permission, clinical work included; assigns roles; reads any chart (audited as executive access); same self-approval limits as everyone |
| ADM | Hospital Administrator | Departments, doctors, schedules, fees, operational settings, nurse assignments, approvals, emergency-access review, audit log, account disable/enable and password reset (not SA accounts) |
| REC | Receptionist | Patients, appointments, walk-ins, check-in, queue, follow-ups, bills and payments, discounts within the limit, enquiries |
| DOC | Doctor | Own queue and patients' consultations, notes, diagnoses, allergies, prescriptions, lab orders, follow-ups; emergency access |
| NUR | Nurse | My patients today (administrator-assigned sessions only): chart, vitals, allergies; medicine search |
| PHA | Pharmacist | Prescription queue, dispensing, substitution, returns, pharmacy stock and transfers, catalogue, pharmacy bills |
| LAB | Lab Technician | Worklist, sample collection, results, verification of someone else's results |
| FIN | Accountant / Finance Manager | Invoices, payments, voids, credit notes, reversals, discount and refund approval, prices, expenses, finance reports |
| HR | HR Manager | Adds staff and logins, staff records, attendance, leave decisions, discount approval (waiting list only), notices |
| INV | Inventory / Procurement Manager | Suppliers, purchase orders, goods receipts, store stock and transfers, catalogue, equipment and maintenance |
| MKT | Marketing Manager | Enquiries, referral sources, campaigns, aggregate conversion reports; never patient records |

## 2. Releases

| Release | Theme |
|---|---|
| R1 | Integrated outpatient journey: secure Super Admin bootstrap, minimal staff-account administration, sign-in, patients, doctor availability, appointments, check-in, consultation, nursing (with nurse assignments), dispensing, lab, basic billing, payments, in-app receipts, pending corrections, follow-ups |
| R2 | Administration and governance: full account management (password resets, work emails, role definitions), departments, doctors, schedules, fees, settings, audit viewer, emergency access and its review, My Devices, end-of-day job (an addition beyond the built reference) |
| R3 | Finance and billing corrections: discounts, credit notes, refunds, reversals, voids, prices and GST, expenses, finance reports |
| R4 | Pharmacy stock, inventory and equipment: returns, adjustments, transfers, catalogue, suppliers, purchase orders, goods receipts, equipment |
| R5 | HR: staff records, attendance, leave, HR discount approval |
| R6 | Outreach and analytics: enquiries, referrals, campaigns, consents, hospital statistics, doctor reports |
| R7 | Messaging and notices: notices, messages, call requests, live updates, push notifications, offline read cache |
| R8 | Video meetings: instant, emergency and scheduled |
| R9 | Production hardening and release (no new permissions) |

A permission's release is when the app first offers its screens. The API enforces every permission
from the day its endpoint exists. **Exception:** `payroll:manage` stays in the catalogue, the seed
and the tests (granted to SA and HR, as in the reference), but no payroll screen or endpoint is
planned; payroll is a future enhancement (scope §7). R5 is only where it is listed.

## 3. Role × permission grid

● = granted. Record-level limits (section 4) still apply to a granted permission.

| # | Permission | Release | SA | ADM | REC | DOC | NUR | PHA | LAB | FIN | HR | INV | MKT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `user:manage` | R1 | ● | ● |  |  |  |  |  |  |  |  |  |
| 2 | `user:create` | R1 | ● |  |  |  |  |  |  |  | ● |  |  |
| 3 | `user_role:assign` | R1 | ● |  |  |  |  |  |  |  |  |  |  |
| 4 | `patient:create` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 5 | `patient:update_demographics` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 6 | `patient:read_demographics` | R1 | ● | ● | ● | ● | ● | ● | ● | ● |  |  |  |
| 7 | `patient:read_clinical` | R1 | ● |  |  | ● | ● | ● | ● |  |  |  |  |
| 8 | `allergy:record` | R1 | ● |  |  | ● | ● |  |  |  |  |  |  |
| 9 | `history:write` | R1 | ● |  |  | ● |  |  |  |  |  |  |  |
| 10 | `schedule:read` | R1 | ● | ● | ● | ● | ● |  |  |  |  |  | ● |
| 11 | `nurse_assignment:manage` | R1 | ● | ● |  |  |  |  |  |  |  |  |  |
| 12 | `appointment:book` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 13 | `appointment:cancel` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 14 | `appointment:reschedule` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 15 | `appointment:check_in` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 16 | `appointment:mark_no_show` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 17 | `followup:schedule` | R1 | ● |  | ● |  |  |  |  |  |  |  |  |
| 18 | `appointment:read_all` | R1 | ● | ● | ● |  |  |  |  |  |  |  |  |
| 19 | `queue:read` | R1 | ● | ● | ● | ● | ● |  |  |  |  |  |  |
| 20 | `encounter:write` | R1 | ● |  |  | ● |  |  |  |  |  |  |  |
| 21 | `prescription:create` | R1 | ● |  |  | ● |  |  |  |  |  |  |  |
| 22 | `prescription:cancel` | R1 | ● |  |  | ● |  |  |  |  |  |  |  |
| 23 | `lab_order:create` | R1 | ● |  |  | ● |  |  |  |  |  |  |  |
| 24 | `lab_order:cancel` | R1 | ● |  |  | ● |  |  |  |  |  |  |  |
| 25 | `followup:recommend` | R1 | ● |  |  | ● |  |  |  |  |  |  |  |
| 26 | `vitals:record` | R1 | ● |  |  | ● | ● |  |  |  |  |  |  |
| 27 | `medicine:search` | R1 | ● | ● |  | ● | ● | ● |  |  |  | ● |  |
| 28 | `prescription:dispense` | R1 | ● |  |  |  |  | ● |  |  |  |  |  |
| 29 | `dispense:substitute` | R1 | ● |  |  |  |  | ● |  |  |  |  |  |
| 30 | `prescription:close` | R1 | ● |  |  |  |  | ● |  |  |  |  |  |
| 31 | `lab:process` | R1 | ● |  |  |  |  |  | ● |  |  |  |  |
| 32 | `lab_result:enter` | R1 | ● |  |  |  |  |  | ● |  |  |  |  |
| 33 | `lab_result:verify` | R1 | ● |  |  |  |  |  | ● |  |  |  |  |
| 34 | `invoice:read` | R1 | ● | ● | ● |  |  | ● |  | ● |  |  |  |
| 35 | `invoice:issue` | R1 | ● |  | ● |  |  | ● |  | ● |  |  |  |
| 36 | `payment:record` | R1 | ● |  | ● |  |  | ● |  | ● |  |  |  |
| 37 | `operations:oversee` | R1 | ● |  |  |  |  |  |  |  |  |  |  |
| 38 | `role:manage` | R2 | ● |  |  |  |  |  |  |  |  |  |  |
| 39 | `system_settings:manage` | R2 | ● |  |  |  |  |  |  |  |  |  |  |
| 40 | `security_settings:manage` | R2 | ● |  |  |  |  |  |  |  |  |  |  |
| 41 | `operational_settings:manage` | R2 | ● | ● |  |  |  |  |  |  |  |  |  |
| 42 | `department:manage` | R2 | ● | ● |  |  |  |  |  |  |  |  |  |
| 43 | `audit:read` | R2 | ● | ● |  |  |  |  |  |  |  |  |  |
| 44 | `break_glass:review` | R2 | ● | ● |  |  |  |  |  |  |  |  |  |
| 45 | `day_close:run` | R2 | ● | ● |  |  |  |  |  |  |  |  |  |
| 46 | `schedule:manage` | R2 | ● | ● |  |  |  |  |  |  |  |  |  |
| 47 | `fee:manage` | R2 | ● | ● |  |  |  |  |  |  |  |  |  |
| 48 | `break_glass:use` | R2 | ● |  |  | ● |  |  |  |  |  |  |  |
| 49 | `invoice:discard_draft` | R3 | ● |  | ● |  |  | ● |  | ● |  |  |  |
| 50 | `refund:request` | R3 | ● |  | ● |  |  | ● |  | ● |  |  |  |
| 51 | `discount:apply` | R3 | ● |  | ● |  |  |  |  | ● |  |  |  |
| 52 | `discount:approve` | R3 | ● | ● |  |  |  |  |  | ● | ● |  |  |
| 53 | `refund:approve` | R3 | ● | ● |  |  |  |  |  | ● |  |  |  |
| 54 | `invoice:void` | R3 | ● |  |  |  |  |  |  | ● |  |  |  |
| 55 | `credit_note:create` | R3 | ● |  |  |  |  |  |  | ● |  |  |  |
| 56 | `payment:reverse` | R3 | ● |  |  |  |  |  |  | ● |  |  |  |
| 57 | `price:manage` | R3 | ● | ● |  |  |  |  |  | ● |  |  |  |
| 58 | `expense:create` | R3 | ● |  |  |  |  |  |  | ● |  |  |  |
| 59 | `expense:approve` | R3 | ● | ● |  |  |  |  |  |  |  |  |  |
| 60 | `report:finance` | R3 | ● | ● |  |  |  |  |  | ● |  |  |  |
| 61 | `dispense:return` | R4 | ● |  |  |  |  | ● |  |  |  |  |  |
| 62 | `medicine:catalog_manage` | R4 | ● |  |  |  |  | ● |  |  |  | ● |  |
| 63 | `stock:adjust_pharmacy` | R4 | ● |  |  |  |  | ● |  |  |  |  |  |
| 64 | `stock:adjust_store` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 65 | `goods_receipt:create` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 66 | `stock_transfer:dispatch_pharmacy` | R4 | ● |  |  |  |  | ● |  |  |  |  |  |
| 67 | `stock_transfer:dispatch_store` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 68 | `stock_transfer:receive_pharmacy` | R4 | ● |  |  |  |  | ● |  |  |  |  |  |
| 69 | `stock_transfer:receive_store` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 70 | `supplier:manage` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 71 | `po:create` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 72 | `po:approve` | R4 | ● | ● |  |  |  |  |  |  |  |  |  |
| 73 | `equipment:manage` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 74 | `maintenance:log` | R4 | ● |  |  |  |  |  |  |  |  | ● |  |
| 75 | `employee:read` | R5 | ● | ● |  |  |  |  |  |  | ● |  |  |
| 76 | `employee:manage` | R5 | ● |  |  |  |  |  |  |  | ● |  |  |
| 77 | `attendance:manage` | R5 | ● |  |  |  |  |  |  |  | ● |  |  |
| 78 | `leave:approve` | R5 | ● |  |  |  |  |  |  |  | ● |  |  |
| 79 | `payroll:manage` | R5 | ● |  |  |  |  |  |  |  | ● |  |  |
| 80 | `leave:request` | R5 | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 81 | `report:operational` | R6 | ● | ● |  |  |  |  |  |  |  |  |  |
| 82 | `enquiry:manage` | R6 | ● |  | ● |  |  |  |  |  |  |  | ● |
| 83 | `campaign:manage` | R6 | ● |  |  |  |  |  |  |  |  |  | ● |
| 84 | `report:marketing` | R6 | ● | ● |  |  |  |  |  |  |  |  | ● |
| 85 | `message:send` | R7 | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| 86 | `notice:publish` | R7 | ● | ● |  |  |  |  |  |  | ● |  |  |
| 87 | `call_request:create` | R7 | ● | ● |  | ● | ● | ● | ● |  |  |  |  |
| 88 | `meeting:create` | R8 | ● | ● |  | ● | ● |  |  |  | ● |  |  |

**Totals:** 88 permissions. Grants per role: SA 88 · ADM 29 · REC 21 · DOC 19 · NUR 11 · PHA 19 · LAB 8 · FIN 17 · HR 11 · INV 12 · MKT 6. Per release: R1 37 · R2 11 · R3 12 · R4 14 · R5 6 · R6 4 · R7 3 · R8 1.

## 4. Record-level limits

A granted permission is still limited by these rules, all checked by the API in the service layer.

| # | Rule |
|---|---|
| L1 | **Doctor care relationship.** A doctor reads a chart only while one of these holds: an appointment `booked`, `checked_in` or `in_consultation` from today to 7 days ahead; an encounter in progress or completed in the last 90 days; the target of a `pending` or `booked` follow-up; or a lab test they ordered verified in the last 90 days. Writing is only inside their own `in_progress` encounter. Windows are settings. |
| L2 | **Nurse assignment.** A nurse sees only patients `checked_in` or `in_consultation` today in a doctor session an administrator assigned them to today. Same department isn't enough. Revoking ends access on the next request. |
| L3 | **Queue scope.** `queue:read` alone shows only the caller's own doctor profile. `appointment:read_all` (REC, ADM, SA) shows every doctor, with scheduling fields and identifiers only. |
| L4 | **Pharmacy and lab scope.** PHA sees allergies only for patients with a prescription in the queue; LAB sees only what is attached to the order. Neither sees notes or diagnoses. Department lookups return identifiers (MRN, name, date of birth, sex) plus that department's records. |
| L5 | **Pharmacy invoices.** PHA reads and issues only invoices for visits with dispensing activity. |
| L6 | **Stock by location kind.** Each stock operation is checked against the source or destination location kind (pharmacy or store). Dispatcher, receiver, rejecter and returner of a transfer are different users. |
| L7 | **Nobody approves their own request:** discounts, refunds, purchase orders, expenses, leave, lab verification, emergency-access review, and billing corrections arising from their own cancellation (D1). Database checks back up the service. |
| L8 | **Accounts.** Nobody changes their own roles or status. ADM can't manage SA accounts or assign roles. Only SA manages SA accounts, and the last active SA can't be disabled or lose the role by any path. |
| L9 | **Super Admin.** Holds everything; every chart read without a care relationship is audited as `access: executive`. Consulting and prescribing need a doctor profile on the SA account. SA's lab results are verified by someone else. |
| L10 | **HR and discounts.** HR sees only the waiting-discount list (patient name and MRN, bill number, charge, amount, reason, requester), never the bill or a chart. |
| L11 | **No patient data for INV and MKT**, and for HR apart from L10. MKT sees aggregate numbers only. |
| L12 | **Not found means not found.** A record the caller may not see answers the same 404 as an unknown ID and writes `access.denied`. |
| L13 | **Settings by key.** Each setting belongs to exactly one permission (system, security or operational). Unknown keys are refused. |
| L14 | **Conversations and meetings.** Only members can read a conversation; only invitees can see or join a meeting (others get 404). Messages are never edited or deleted. |

## 5. Data tiers

| Tier | Contents | Who can see it |
|---|---|---|
| Demographics | MRN, name, age, sex, phone | SA, ADM, REC, DOC, NUR, FIN; PHA and LAB within L4. Search returns at most 20 rows, never clinical fields. |
| Clinical | History, allergies, diagnoses, notes, vitals, prescriptions, lab results | DOC (L1), NUR (L2), DOC under an emergency grant (read-only), PHA and LAB within L4, SA (L9) |
| Financial | Invoices, payments | SA, ADM, REC, FIN; PHA within L5 |

## 6. Who approves what

| Request | Asked by | Approved by | Release |
|---|---|---|---|
| Discount above the limit (10%) | REC, FIN, SA | HR, FIN, ADM, SA, never the requester; bill can't be issued meanwhile | R3 (HR from R5) |
| Refund | REC, FIN, PHA | FIN, ADM, SA, never the requester; then marked paid | R3 |
| Purchase order | INV | ADM, SA, never the creator | R4 |
| Expense | FIN | ADM, SA, never the creator | R3 |
| Leave | Everyone, own | HR only | R5 |
| Lab result | LAB enters | Another LAB, or SA | R1 |
| Stock transfer | Sending side | Receiving side, a different user | R4 |
| Emergency access | DOC, SA use it | ADM or SA review afterwards, never the user | R2 |
| Nurse assignment | — | ADM, SA assign a nurse to a doctor session on a date; revoke ends access at once | R1 |
| Billing correction (service cancelled after its invoice was issued) | Opened automatically by the cancellation, whoever cancelled | Resolved (credit note) or rejected (mandatory reason) only by `credit_note:create` holders, FIN or SA (D1), never by the person who made the cancellation; never edited or deleted | Opened R1, resolved or rejected R3 |
| Roles | HR creates the account with no roles (the first SA comes from the audited bootstrap) | SA only, never their own | R1 (minimal, MD-23); role definitions R2 |

## 7. Navigation per role

All roles get the same five tabs. What each tab holds depends on permissions. **Before R7 the
Inbox column below is a polished, clearly labelled "coming in Release 7" state for every role, with
no sample or invented items.**

| Role | Home | Work Queue | Search | Inbox (from R7) | Profile |
|---|---|---|---|---|---|
| SA | Hospital overview, every module | All department queues (read-only oversight in R1) | Patients, medicines, staff | Everything addressed to them, emergency-access alerts | Account, My Devices (R2), settings |
| ADM | Operations, approvals waiting, stuck visits | Approvals, emergency-access reviews (R2) | Patients (demographics), staff | Notices, messages | Account, My Devices (R2) |
| REC | Today's appointments, arrivals, follow-ups due | Queue per doctor, check-ins | Patients | Notices, messages | Account, My Devices (R2) |
| DOC | My appointments, waiting patients | My queue | My patients, medicines | Call requests, messages, meetings | Account, availability (R7) |
| NUR | My patients today | Vitals due for my patients | My patients, medicines | Call requests, messages | Account, My Devices (R2) |
| PHA | Prescriptions waiting, stock warnings (R4) | Prescription queue | Patient by number, medicines | Messages | Account, My Devices (R2) |
| LAB | Samples to collect, results to verify | Worklist | Patient by number | Messages | Account, My Devices (R2) |
| FIN | Bills outstanding, approvals (R3) | Invoices to issue or collect | Patient by number (billing) | Messages | Account, My Devices (R2) |
| HR | Leave requests, attendance (R5) | Leave and discount decisions | Staff | Notices, messages | Account, My Devices (R2) |
| INV | Low stock, POs (R4) | Receipts and transfers to accept | Items, suppliers | Messages | Account, My Devices (R2) |
| MKT | Enquiries, campaigns (R6) | Enquiry follow-ups | Enquiries | Messages | Account, My Devices (R2) |

Hospital modules open from Home, never the tab bar. A role with no screens yet in the current
release sees an honest "arrives in Release N" state, never placeholder figures.

## 8. Screens and actions by role (Release 1)

| Role | Screens | Actions |
|---|---|---|
| REC | Patient search, registration, patient summary, doctor availability, book, reschedule, cancel, walk-in, check-in, queue, day list, follow-ups due, invoice, payment, receipt (in-app view) | `patient:create`, `patient:update_demographics`, `appointment:*`, `followup:schedule`, `invoice:issue`, `payment:record` |
| DOC | My appointments, my queue, chart, encounter (vitals, notes, diagnoses, allergies, history), prescription, lab order, follow-up, medicine search | `encounter:write`, `vitals:record`, `allergy:record`, `history:write`, `prescription:create/cancel`, `lab_order:create/cancel`, `followup:recommend` |
| NUR | My patients today, chart, vitals, allergies, medicine search | `vitals:record`, `allergy:record` (L2) |
| PHA | Prescription queue, prescription detail with allergies, dispense (FEFO, substitution, acknowledgements), close, patient lookup, pharmacy invoice and payment | `prescription:dispense`, `dispense:substitute`, `prescription:close`, `invoice:issue`, `payment:record` |
| LAB | Worklist, sample collection (scan), result entry, verification, amendment, verified report (in-app view only), patient lookup | `lab:process`, `lab_result:enter`, `lab_result:verify` |
| FIN | Invoice list and detail, payment, receipt, open billing corrections (read-only until R3) | `invoice:read`, `invoice:issue`, `payment:record` |
| ADM | Nurse assignments (doctor session + date, revoke), disable and re-enable staff accounts (not SA accounts, not their own), every doctor's day list, invoices and open corrections (read) | `nurse_assignment:manage`, `user:manage`, `appointment:read_all`, `invoice:read` |
| SA | Everything above; assign and revoke staff roles (never their own; last active SA protected); read-only pharmacy and lab oversight | All |
| HR | Add staff member (creates a login with a temporary password the person must change); Home otherwise shows "arrives in Release 5" | `user:create` (MD-23) |
| INV, MKT | Home with a labelled "your workspace arrives in Release N" state, Inbox (coming in R7), Profile, change password | None beyond sign-in in R1 |

Screens for R2 to R8 are listed per release in the [roadmap](MOBILE-IMPLEMENTATION-ROADMAP.md).

## 9. Hard restrictions (each gets an automated test)

- Doctors have no stock or dispensing permission; medicine search is read-only for them.
- Pharmacists can't prescribe and dispense only `issued` or `partially_dispensed` prescriptions.
- Expiry, substitution and stock rules are enforced inside the dispensing transaction.
- Nobody approves their own request (L7); nobody changes their own roles (L8).
- Nobody can alter or delete audit rows; there is no route or permission for it.
- HR, INV and MKT get 403 on every patient-data endpoint, except HR's discount list (L10).
- Nurses have no clinical access without an active assignment (L2), and no note or task actions at
  all.
- An issued invoice is never changed by a cancellation; only `credit_note:create` holders (FIN, SA)
  resolve or reject its billing correction (R3), never the person who cancelled; payments never
  exceed the valid outstanding balance, so a cancelled amount can't be collected meanwhile.
- My Devices (R2): a user sees and revokes only their own sessions; another user's session answers
  404. No permission is needed and none is added (the catalogue stays at 88).
- The development role preview exists only in development builds and never reaches the API.
