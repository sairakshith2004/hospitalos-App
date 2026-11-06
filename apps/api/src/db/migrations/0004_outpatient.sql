-- 0004: integrated outpatient operations (phases 1.4–1.10): patients, appointments and queue,
-- nurse session assignments, encounters and clinical records, prescriptions and dispensing,
-- laboratory, invoices, payments, billing corrections and follow-ups.
-- Rules follow the reference schema and docs/MOBILE-WORKFLOWS.md §3–4. Money is integer paise.
-- Nothing clinical or financial is ever deleted. Forward-only.

-- Patients --------------------------------------------------------------------------------------
create sequence patient_mrn_seq start 1;
create table patients (
  id uuid primary key default gen_random_uuid(),
  mrn text not null unique default ('MRN' || lpad(nextval('patient_mrn_seq')::text, 6, '0')),
  first_name text not null check (length(trim(first_name)) between 1 and 60),
  last_name text not null check (length(trim(last_name)) between 1 and 60),
  dob date not null check (dob >= date '1900-01-01'),
  sex text not null check (sex in ('female', 'male', 'other', 'unknown')),
  phone text not null check (phone ~ '^[0-9]{7,15}$'),
  email citext check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  address text check (address is null or length(address) <= 300),
  blood_group text check (blood_group is null or blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict
);
create index patients_phone_idx on patients (phone);
create index patients_name_trgm on patients using gin ((first_name || ' ' || last_name) gin_trgm_ops);
create index patients_dob_idx on patients (dob);
create trigger patients_updated_at before update on patients for each row execute function set_updated_at();

create table allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete restrict,
  substance text not null check (length(trim(substance)) between 1 and 120),
  ingredient_id uuid references ingredients (id) on delete restrict,
  reaction text check (reaction is null or length(reaction) <= 300),
  severity text not null default 'unknown' check (severity in ('mild', 'moderate', 'severe', 'unknown')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict
);
create index allergies_patient_idx on allergies (patient_id) where status = 'active';
create trigger allergies_updated_at before update on allergies for each row execute function set_updated_at();

-- Appointments, tokens, queue ------------------------------------------------------------------
create sequence appointment_no_seq start 1;
create table appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_no text not null unique default ('APT' || lpad(nextval('appointment_no_seq')::text, 7, '0')),
  patient_id uuid not null references patients (id) on delete restrict,
  doctor_id uuid not null references doctor_profiles (id) on delete restrict,
  department_id uuid not null references departments (id) on delete restrict,
  doctor_schedule_id uuid references doctor_schedules (id) on delete restrict,
  kind text not null check (kind in ('scheduled', 'walk_in', 'follow_up')),
  status text not null default 'booked'
    check (status in ('booked', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  visit_date date not null,
  slot_start timestamptz,
  slot_end timestamptz,
  token_no integer check (token_no is null or token_no > 0),
  checked_in_at timestamptz,
  consult_started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 200),
  no_show_at timestamptz,
  rescheduled_to_id uuid references appointments (id) on delete restrict,
  rescheduled_from_id uuid unique references appointments (id) on delete restrict,
  follow_up_id uuid,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict,
  constraint appointments_walk_in_has_no_slot check ((kind = 'walk_in') = (slot_start is null)),
  constraint appointments_slot_pair check ((slot_start is null) = (slot_end is null)),
  constraint appointments_slot_order check (slot_start is null or slot_start < slot_end),
  constraint appointments_slot_on_visit_date check (slot_start is null or visit_date = (slot_start at time zone 'Asia/Kolkata')::date),
  constraint appointments_follow_up_link check ((kind = 'follow_up') = (follow_up_id is not null)),
  constraint appointments_checked_in_has_token check (
    status not in ('checked_in', 'in_consultation', 'completed') or (checked_in_at is not null and token_no is not null)),
  constraint appointments_cancel_reason check (status <> 'cancelled' or (cancelled_at is not null and length(trim(cancel_reason)) > 0)),
  constraint appointments_no_show_time check (status <> 'no_show' or no_show_at is not null),
  -- Only booked, checked-in and in-consultation appointments occupy a slot. The database refuses a
  -- second one for the same doctor and overlapping time, whatever the application does.
  constraint appointments_no_double_booking exclude using gist (
    doctor_id with =, tstzrange(slot_start, slot_end) with &&)
    where (slot_start is not null and status in ('booked', 'checked_in', 'in_consultation'))
);
create unique index appointments_token_per_doctor_day on appointments (doctor_id, visit_date, token_no) where token_no is not null;
create index appointments_doctor_day_idx on appointments (doctor_id, visit_date, status);
create index appointments_patient_idx on appointments (patient_id, visit_date);
create index appointments_day_idx on appointments (visit_date, status);
create trigger appointments_updated_at before update on appointments for each row execute function set_updated_at();

-- Nurse assigned to a doctor's session on one date (ADM/SA).
create table nurse_assignments (
  id uuid primary key default gen_random_uuid(),
  nurse_user_id uuid not null references users (id) on delete restrict,
  doctor_id uuid not null references doctor_profiles (id) on delete restrict,
  doctor_schedule_id uuid not null,
  session_date date not null,
  assigned_by uuid not null references users (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references users (id) on delete restrict,
  revoke_reason text check (revoke_reason is null or length(revoke_reason) <= 300),
  constraint nurse_assignments_schedule_doctor foreign key (doctor_schedule_id, doctor_id)
    references doctor_schedules (id, doctor_id) on delete restrict,
  constraint nurse_assignments_revocation check ((revoked_at is null) = (revoked_by is null))
);
create unique index nurse_assignments_active on nurse_assignments (nurse_user_id, doctor_schedule_id, session_date)
  where revoked_at is null;
create index nurse_assignments_lookup on nurse_assignments (nurse_user_id, session_date) where revoked_at is null;

-- Encounters and clinical records ---------------------------------------------------------------
create sequence encounter_no_seq start 1;
create table encounters (
  id uuid primary key default gen_random_uuid(),
  encounter_no text not null unique default ('ENC' || lpad(nextval('encounter_no_seq')::text, 7, '0')),
  appointment_id uuid not null references appointments (id) on delete restrict,
  patient_id uuid not null references patients (id) on delete restrict,
  doctor_id uuid not null references doctor_profiles (id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'entered_in_error')),
  chief_complaint text check (chief_complaint is null or length(chief_complaint) <= 500),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_reason text check (error_reason is null or length(error_reason) <= 300),
  created_by uuid references users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint encounters_completion check ((status = 'completed') = (completed_at is not null)),
  constraint encounters_error_reason check (status <> 'entered_in_error' or length(trim(coalesce(error_reason, ''))) > 0)
);
-- One live encounter per appointment (an encounter entered in error doesn't block a new one).
create unique index encounters_one_live_per_appointment on encounters (appointment_id) where status <> 'entered_in_error';
create index encounters_patient_idx on encounters (patient_id, started_at);
create trigger encounters_updated_at before update on encounters for each row execute function set_updated_at();

create table vital_signs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete restrict,
  patient_id uuid not null references patients (id) on delete restrict,
  recorded_by uuid not null references users (id) on delete restrict,
  recorded_at timestamptz not null default now(),
  temp_c numeric(4, 1) check (temp_c is null or temp_c between 30 and 45),
  pulse integer check (pulse is null or pulse between 20 and 250),
  bp_sys integer check (bp_sys is null or bp_sys between 50 and 260),
  bp_dia integer check (bp_dia is null or bp_dia between 20 and 160),
  resp_rate integer check (resp_rate is null or resp_rate between 4 and 80),
  spo2 integer check (spo2 is null or spo2 between 50 and 100),
  weight_kg numeric(5, 1) check (weight_kg is null or weight_kg between 0.3 and 400),
  height_cm numeric(4, 1) check (height_cm is null or height_cm between 20 and 260),
  entered_in_error boolean not null default false,
  constraint vital_signs_something check (num_nonnulls(temp_c, pulse, bp_sys, resp_rate, spo2, weight_kg, height_cm) > 0),
  constraint vital_signs_bp_pair check ((bp_sys is null) = (bp_dia is null))
);
create index vital_signs_patient_idx on vital_signs (patient_id, recorded_at);

create table clinical_notes (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters (id) on delete restrict,
  kind text not null check (kind in ('symptoms', 'observation', 'plan', 'addendum')),
  body text not null check (length(trim(body)) between 1 and 5000),
  author_id uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index clinical_notes_encounter_idx on clinical_notes (encounter_id, created_at);
create trigger clinical_notes_append_only before update or delete on clinical_notes
  for each row execute function reject_change();

create table diagnoses (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references encounters (id) on delete restrict,
  description text not null check (length(trim(description)) between 1 and 300),
  code text check (code is null or length(code) <= 20),
  is_primary boolean not null default false,
  created_by uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now()
);
create index diagnoses_encounter_idx on diagnoses (encounter_id);
create trigger diagnoses_append_only before update or delete on diagnoses
  for each row execute function reject_change();

-- Prescriptions and dispensing -----------------------------------------------------------------
create sequence rx_no_seq start 1;
create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  rx_no text not null unique default ('RX' || lpad(nextval('rx_no_seq')::text, 7, '0')),
  encounter_id uuid not null references encounters (id) on delete restrict,
  patient_id uuid not null references patients (id) on delete restrict,
  doctor_id uuid not null references doctor_profiles (id) on delete restrict,
  status text not null default 'issued' check (status in ('issued', 'partially_dispensed', 'dispensed', 'cancelled', 'closed')),
  issued_at timestamptz not null default now(),
  valid_until date not null,
  notes text check (notes is null or length(notes) <= 1000),
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300),
  close_reason text check (close_reason is null or length(close_reason) <= 300),
  version integer not null default 1,
  created_by uuid references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint prescriptions_cancel_reason check (status <> 'cancelled' or length(trim(coalesce(cancel_reason, ''))) > 0),
  constraint prescriptions_close_reason check (status <> 'closed' or length(trim(coalesce(close_reason, ''))) > 0)
);
create index prescriptions_queue_idx on prescriptions (status, issued_at) where status in ('issued', 'partially_dispensed');
create index prescriptions_patient_idx on prescriptions (patient_id);
create trigger prescriptions_updated_at before update on prescriptions for each row execute function set_updated_at();

create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions (id) on delete restrict,
  stock_item_id uuid not null references medicine_products (stock_item_id) on delete restrict,
  dose text not null check (length(trim(dose)) between 1 and 60),
  frequency text not null check (length(trim(frequency)) between 1 and 60),
  route text not null check (route in ('oral', 'topical', 'iv', 'im', 'sc', 'inhalation', 'ophthalmic', 'otic', 'nasal')),
  duration_days integer check (duration_days is null or duration_days between 1 and 365),
  qty_prescribed integer not null check (qty_prescribed > 0),
  qty_dispensed integer not null default 0,
  substitution_allowed boolean not null default false,
  allergy_acknowledged boolean not null default false,
  instructions text check (instructions is null or length(instructions) <= 300),
  constraint prescription_items_dispensed_range check (qty_dispensed between 0 and qty_prescribed)
);
create index prescription_items_rx_idx on prescription_items (prescription_id);

create sequence dispense_no_seq start 1;
create table dispensings (
  id uuid primary key default gen_random_uuid(),
  dispense_no text not null unique default ('DSP' || lpad(nextval('dispense_no_seq')::text, 7, '0')),
  prescription_id uuid not null references prescriptions (id) on delete restrict,
  patient_id uuid not null references patients (id) on delete restrict,
  location_id uuid not null references locations (id) on delete restrict,
  dispensed_by uuid not null references users (id) on delete restrict,
  dispensed_at timestamptz not null default now()
);
create index dispensings_rx_idx on dispensings (prescription_id);

create table dispensing_lines (
  id uuid primary key default gen_random_uuid(),
  dispensing_id uuid not null references dispensings (id) on delete restrict,
  prescription_item_id uuid not null references prescription_items (id) on delete restrict,
  batch_id uuid not null references stock_batches (id) on delete restrict,
  stock_item_id uuid not null references stock_items (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  substituted boolean not null default false,
  near_expiry_acknowledged boolean not null default false,
  stock_movement_id bigint not null unique references stock_movements (id) on delete restrict
);
create index dispensing_lines_dispensing_idx on dispensing_lines (dispensing_id);
create trigger dispensings_append_only before update or delete on dispensings
  for each row execute function reject_change();
create trigger dispensing_lines_append_only before update or delete on dispensing_lines
  for each row execute function reject_change();

-- Laboratory -----------------------------------------------------------------------------------
create sequence lab_order_no_seq start 1;
create table lab_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default ('LAB' || lpad(nextval('lab_order_no_seq')::text, 7, '0')),
  encounter_id uuid not null references encounters (id) on delete restrict,
  patient_id uuid not null references patients (id) on delete restrict,
  test_id uuid not null references lab_tests (id) on delete restrict,
  ordered_by uuid not null references users (id) on delete restrict,
  priority text not null default 'routine' check (priority in ('routine', 'urgent')),
  status text not null default 'ordered'
    check (status in ('ordered', 'sample_collected', 'in_process', 'resulted', 'verified', 'cancelled')),
  clinical_notes text check (clinical_notes is null or length(clinical_notes) <= 500),
  sample_barcode text unique check (sample_barcode is null or sample_barcode ~ '^[A-Za-z0-9-]{4,40}$'),
  collected_by uuid references users (id) on delete restrict,
  collected_at timestamptz,
  resulted_by uuid references users (id) on delete restrict,
  resulted_at timestamptz,
  verified_by uuid references users (id) on delete restrict,
  verified_at timestamptz,
  cancelled_by uuid references users (id) on delete restrict,
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Results are verified by someone other than the person who entered them.
  constraint lab_orders_independent_verification check (verified_by is null or verified_by <> resulted_by),
  constraint lab_orders_collected check (status not in ('sample_collected', 'in_process', 'resulted', 'verified') or collected_at is not null),
  constraint lab_orders_resulted check (status not in ('resulted', 'verified') or resulted_at is not null),
  constraint lab_orders_verified check ((status = 'verified') = (verified_at is not null)),
  constraint lab_orders_cancelled check (status <> 'cancelled' or (cancelled_at is not null and length(trim(coalesce(cancel_reason, ''))) > 0))
);
create index lab_orders_worklist_idx on lab_orders (status, created_at) where status not in ('verified', 'cancelled');
create index lab_orders_patient_idx on lab_orders (patient_id);
create trigger lab_orders_updated_at before update on lab_orders for each row execute function set_updated_at();

create table lab_results (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references lab_orders (id) on delete restrict,
  parameter_id uuid not null references lab_test_parameters (id) on delete restrict,
  value_num numeric(14, 4),
  value_text text check (value_text is null or length(value_text) <= 200),
  unit text,
  ref_low numeric(14, 4),
  ref_high numeric(14, 4),
  abnormal_flag text check (abnormal_flag is null or abnormal_flag in ('low', 'normal', 'high')),
  entered_by uuid not null references users (id) on delete restrict,
  entered_at timestamptz not null default now(),
  is_current boolean not null default true,
  constraint lab_results_value check (value_num is not null or length(trim(coalesce(value_text, ''))) > 0)
);
create unique index lab_results_one_current on lab_results (order_id, parameter_id) where is_current;

-- Billing --------------------------------------------------------------------------------------
-- Gapless document numbers per fiscal year (row-locked counters).
create table document_counters (
  doc_type text not null check (doc_type in ('invoice', 'receipt')),
  fiscal_year integer not null check (fiscal_year between 2000 and 2100),
  next_value integer not null default 1 check (next_value >= 1),
  primary key (doc_type, fiscal_year)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique,
  patient_id uuid not null references patients (id) on delete restrict,
  appointment_id uuid not null references appointments (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  subtotal_paise bigint not null default 0,
  discount_paise bigint not null default 0,
  tax_paise bigint not null default 0,
  total_paise bigint not null default 0,
  paid_paise bigint not null default 0,
  issued_at timestamptz,
  issued_by uuid references users (id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  constraint invoices_total check (total_paise = subtotal_paise - discount_paise + tax_paise),
  constraint invoices_non_negative check (subtotal_paise >= 0 and discount_paise >= 0 and tax_paise >= 0 and total_paise >= 0),
  constraint invoices_paid_range check (paid_paise between 0 and total_paise),
  constraint invoices_number_when_issued check ((status = 'draft') = (invoice_no is null)),
  constraint invoices_issued_time check ((status = 'draft') = (issued_at is null)),
  constraint invoices_unpaid_draft check (status not in ('draft', 'void') or paid_paise = 0)
);
-- One draft invoice per visit at a time.
create unique index invoices_one_draft_per_visit on invoices (appointment_id) where status = 'draft';
create index invoices_patient_idx on invoices (patient_id);
create index invoices_status_idx on invoices (status, created_at);
create trigger invoices_updated_at before update on invoices for each row execute function set_updated_at();

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete restrict,
  service_id uuid references service_catalogue (id) on delete restrict,
  description text not null check (length(trim(description)) between 1 and 200),
  source_type text not null check (source_type in ('consultation', 'dispensing', 'lab', 'manual')),
  consultation_appointment_id uuid references appointments (id) on delete restrict,
  dispensing_line_id uuid unique references dispensing_lines (id) on delete restrict,
  lab_order_id uuid references lab_orders (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price_paise bigint not null check (unit_price_paise >= 0),
  line_total_paise bigint not null,
  is_active boolean not null default true,
  deactivated_at timestamptz,
  deactivated_by uuid references users (id) on delete restrict,
  deactivation_reason text check (deactivation_reason is null or length(deactivation_reason) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  constraint invoice_items_total check (line_total_paise = qty * unit_price_paise),
  constraint invoice_items_source check (
    (source_type = 'consultation') = (consultation_appointment_id is not null)
    and (source_type = 'dispensing') = (dispensing_line_id is not null)
    and (source_type = 'lab') = (lab_order_id is not null)),
  constraint invoice_items_deactivation check (is_active = (deactivated_at is null))
);
-- A service is charged once: one active consultation line per appointment, one per lab order.
create unique index invoice_items_one_consultation on invoice_items (consultation_appointment_id) where is_active and consultation_appointment_id is not null;
create unique index invoice_items_one_lab_order on invoice_items (lab_order_id) where is_active and lab_order_id is not null;
create index invoice_items_invoice_idx on invoice_items (invoice_id);

-- An issued invoice is never changed silently: its lines are frozen and its amounts fixed.
create function invoice_items_draft_only() returns trigger language plpgsql as $$
declare
  invoice_status text;
begin
  select status into invoice_status from invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if invoice_status <> 'draft' then
    raise exception 'lines of an issued invoice cannot change' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and ((to_jsonb(new) - array['is_active', 'deactivated_at', 'deactivated_by', 'deactivation_reason'])
                           <> (to_jsonb(old) - array['is_active', 'deactivated_at', 'deactivated_by', 'deactivation_reason'])
                           or (old.is_active = false and new.is_active = true)) then
    raise exception 'an invoice line can only be deactivated' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end
$$;
create trigger invoice_items_draft_only before insert or update or delete on invoice_items
  for each row execute function invoice_items_draft_only();

create function invoices_freeze_issued() returns trigger language plpgsql as $$
begin
  if old.status <> 'draft' and (new.subtotal_paise, new.discount_paise, new.tax_paise, new.total_paise, new.invoice_no,
                                new.patient_id, new.appointment_id, new.issued_at)
                             is distinct from (old.subtotal_paise, old.discount_paise, old.tax_paise, old.total_paise,
                                old.invoice_no, old.patient_id, old.appointment_id, old.issued_at) then
    raise exception 'an issued invoice cannot be rewritten' using errcode = 'check_violation';
  end if;
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'an issued invoice cannot return to draft' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger invoices_freeze_issued before update on invoices for each row execute function invoices_freeze_issued();
create trigger invoices_no_delete before delete on invoices for each row execute function reject_change();

create table payments (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  invoice_id uuid not null references invoices (id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  method text not null check (method in ('cash', 'card', 'upi', 'bank')),
  reference text check (reference is null or length(reference) <= 80),
  received_by uuid not null references users (id) on delete restrict,
  received_at timestamptz not null default now()
);
create index payments_invoice_idx on payments (invoice_id);
create trigger payments_append_only before update or delete on payments
  for each row execute function reject_change();

-- A cancelled service on an issued invoice (MD-11): the invoice stays as issued; Finance resolves
-- the correction in R3. Until then its amount can't be collected.
create table billing_corrections (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete restrict,
  invoice_item_id uuid not null references invoice_items (id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  origin text not null check (origin in ('appointment_cancel', 'lab_cancel')),
  reason text not null check (length(trim(reason)) between 1 and 300),
  initiated_by uuid not null references users (id) on delete restrict,
  initiated_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  refund_may_be_due boolean not null default false,
  resolved_by uuid references users (id) on delete restrict,
  resolved_at timestamptz,
  constraint billing_corrections_separation_of_duties check (resolved_by is null or resolved_by <> initiated_by)
);
create unique index billing_corrections_one_open_per_line on billing_corrections (invoice_item_id) where status = 'open';
create index billing_corrections_invoice_idx on billing_corrections (invoice_id) where status = 'open';

-- Follow-ups ------------------------------------------------------------------------------------
create table follow_ups (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete restrict,
  source_encounter_id uuid not null references encounters (id) on delete restrict,
  recommended_by uuid not null references users (id) on delete restrict,
  target_doctor_id uuid references doctor_profiles (id) on delete restrict,
  reason text not null check (length(trim(reason)) between 1 and 300),
  instructions text check (instructions is null or length(instructions) <= 500),
  due_from date not null,
  due_to date not null,
  status text not null default 'pending' check (status in ('pending', 'booked', 'completed', 'missed', 'cancelled')),
  booked_appointment_id uuid references appointments (id) on delete restrict,
  cancel_reason text check (cancel_reason is null or length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint follow_ups_window check (due_from <= due_to),
  constraint follow_ups_booked_link check ((status in ('booked', 'completed', 'missed')) = (booked_appointment_id is not null)),
  constraint follow_ups_cancel_reason check (status <> 'cancelled' or length(trim(coalesce(cancel_reason, ''))) > 0)
);
create index follow_ups_status_idx on follow_ups (status, due_to);
create index follow_ups_patient_idx on follow_ups (patient_id);
create trigger follow_ups_updated_at before update on follow_ups for each row execute function set_updated_at();
alter table appointments add constraint appointments_follow_up_fk
  foreign key (follow_up_id) references follow_ups (id) on delete restrict;

-- hos_app privileges ------------------------------------------------------------------------------
-- Default: SELECT, INSERT, UPDATE. Append-only records lose UPDATE; nothing here gets DELETE.
revoke update on clinical_notes, diagnoses, dispensings, dispensing_lines, payments from hos_app;
revoke insert, update on document_counters from hos_app;
grant insert, update on document_counters to hos_app;
