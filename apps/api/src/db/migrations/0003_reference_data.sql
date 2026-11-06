-- 0003: hospital reference data (phase 1.3): doctors, schedules, services and prices, locations,
-- medicine catalogue with batches and stock movements, laboratory tests. Rules follow the
-- reference schema. Money is integer paise. Forward-only.

-- Doctors ---------------------------------------------------------------------------------------
create table doctor_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references employees (id) on delete restrict,
  department_id uuid not null references departments (id) on delete restrict,
  specialty text not null check (length(trim(specialty)) between 1 and 80),
  registration_no text not null unique check (length(trim(registration_no)) between 3 and 40),
  default_slot_minutes integer not null default 15 check (default_slot_minutes between 5 and 120),
  consultation_fee_paise bigint not null check (consultation_fee_paise between 0 and 100000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict
);
create index doctor_profiles_department_idx on doctor_profiles (department_id) where active;
create trigger doctor_profiles_updated_at before update on doctor_profiles
  for each row execute function set_updated_at();

-- Weekly working hours. weekday: ISO 1 = Monday … 7 = Sunday. Times are hospital-local.
create table doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctor_profiles (id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null check (slot_minutes between 5 and 120),
  valid_from date not null default current_date,
  valid_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict,
  constraint doctor_schedules_time_order check (start_time < end_time),
  constraint doctor_schedules_fits_one_slot check (end_time - start_time >= make_interval(mins => slot_minutes)),
  constraint doctor_schedules_validity check (valid_to is null or valid_to >= valid_from),
  unique (id, doctor_id)
);
create index doctor_schedules_doctor_idx on doctor_schedules (doctor_id, weekday) where active;
create trigger doctor_schedules_updated_at before update on doctor_schedules
  for each row execute function set_updated_at();

-- Leave or blocked periods: no slots are offered inside them.
create table schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctor_profiles (id) on delete restrict,
  kind text not null check (kind in ('leave', 'blocked')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or length(reason) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  constraint schedule_exceptions_order check (starts_at < ends_at)
);
create index schedule_exceptions_doctor_idx on schedule_exceptions (doctor_id, starts_at) where active;

-- Services and prices (GST arrives in R3; no tax columns are filled in R1) ----------------------
create table service_catalogue (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_-]{1,29}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  department_id uuid references departments (id) on delete restrict,
  kind text not null check (kind in ('consultation', 'lab', 'procedure', 'other')),
  price_paise bigint not null check (price_paise between 0 and 100000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict
);
create trigger service_catalogue_updated_at before update on service_catalogue
  for each row execute function set_updated_at();

-- Locations ------------------------------------------------------------------------------------
create table locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_-]{1,19}$'),
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('pharmacy', 'store', 'lab', 'opd_room')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, kind)
);

-- Medicine catalogue: generic ingredients, branded products, strengths and forms ---------------
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table stock_items (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  kind text not null check (kind in ('medicine', 'general')),
  name text not null check (length(trim(name)) between 1 and 160),
  base_unit text not null check (base_unit in ('tablet', 'capsule', 'ml', 'bottle', 'tube', 'vial', 'sachet', 'piece', 'strip')),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  tracks_expiry boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stock_items_medicine_expiry check (kind <> 'medicine' or tracks_expiry)
);
create index stock_items_name_trgm on stock_items using gin (name gin_trgm_ops);
create trigger stock_items_updated_at before update on stock_items
  for each row execute function set_updated_at();

create table medicine_products (
  stock_item_id uuid primary key references stock_items (id) on delete restrict,
  brand_name text not null check (length(trim(brand_name)) between 1 and 120),
  manufacturer text check (manufacturer is null or length(manufacturer) <= 120),
  dosage_form text not null check (dosage_form in (
    'tablet', 'capsule', 'syrup', 'suspension', 'injection', 'ointment', 'cream', 'drops', 'inhaler', 'powder', 'gel')),
  route text not null check (route in ('oral', 'topical', 'iv', 'im', 'sc', 'inhalation', 'ophthalmic', 'otic', 'nasal')),
  pack_size text check (pack_size is null or length(pack_size) <= 40),
  rx_only boolean not null default true,
  created_at timestamptz not null default now()
);
create index medicine_products_brand_trgm on medicine_products using gin (brand_name gin_trgm_ops);

create table product_ingredients (
  product_id uuid not null references medicine_products (stock_item_id) on delete restrict,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  strength_value numeric(12, 4) not null check (strength_value > 0),
  strength_unit text not null check (strength_unit in ('mg', 'g', 'mcg', 'ml', 'IU', '%', 'mg/ml', 'mg/5ml')),
  primary key (product_id, ingredient_id)
);
create index product_ingredients_ingredient_idx on product_ingredients (ingredient_id);

-- Batches per location. Quantities are integers in the item's base unit.
create table stock_batches (
  id uuid primary key default gen_random_uuid(),
  stock_item_id uuid not null references stock_items (id) on delete restrict,
  location_id uuid not null references locations (id) on delete restrict,
  batch_no text not null check (length(trim(batch_no)) between 1 and 40),
  expiry_date date,
  unit_cost_paise bigint not null default 0 check (unit_cost_paise >= 0),
  sale_price_paise bigint not null default 0 check (sale_price_paise >= 0),
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  status text not null default 'active' check (status in ('active', 'quarantined', 'recalled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stock_item_id, location_id, batch_no)
);
create index stock_batches_fefo_idx on stock_batches (stock_item_id, location_id, expiry_date)
  where status = 'active' and qty_on_hand > 0;
create trigger stock_batches_updated_at before update on stock_batches
  for each row execute function set_updated_at();

-- Every quantity change is a movement row; the batch quantity equals the sum of its movements.
create table stock_movements (
  id bigint generated always as identity primary key,
  batch_id uuid not null references stock_batches (id) on delete restrict,
  kind text not null check (kind in ('receipt', 'dispense', 'adjustment_in', 'adjustment_out')),
  qty integer not null check (qty <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text check (reason is null or length(reason) <= 300),
  ref_type text,
  ref_id text,
  performed_by uuid references users (id) on delete restrict,
  actor_label text,
  occurred_at timestamptz not null default now(),
  constraint stock_movements_sign check ((kind in ('receipt', 'adjustment_in')) = (qty > 0)),
  constraint stock_movements_actor check (performed_by is not null or actor_label is not null)
);
create index stock_movements_batch_idx on stock_movements (batch_id, occurred_at);
create trigger stock_movements_append_only before update or delete on stock_movements
  for each row execute function reject_change();

-- Laboratory tests and their parameters with reference ranges -----------------------------------
create table lab_tests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_-]{1,19}$'),
  name text not null check (length(trim(name)) between 1 and 120),
  sample_type text not null check (sample_type in ('blood', 'serum', 'plasma', 'urine', 'stool', 'swab', 'other')),
  service_id uuid not null unique references service_catalogue (id) on delete restrict,
  turnaround_hours integer not null check (turnaround_hours between 1 and 720),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table lab_test_parameters (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references lab_tests (id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 80),
  unit text check (unit is null or length(unit) <= 20),
  ref_low numeric(14, 4),
  ref_high numeric(14, 4),
  ref_text text check (ref_text is null or length(ref_text) <= 120),
  sort_order integer not null default 0,
  unique (test_id, name),
  unique (id, test_id),
  constraint lab_test_parameters_range check (ref_low is null or ref_high is null or ref_low <= ref_high)
);

-- hos_app privileges ------------------------------------------------------------------------------
-- Catalogues are maintained by seed and by authorized management endpoints (fees, prices,
-- schedules). Reference rows are never deleted; stock movements are insert-only.
revoke update on locations, ingredients, product_ingredients, medicine_products, lab_tests,
  lab_test_parameters from hos_app;
revoke insert on locations, ingredients, product_ingredients, medicine_products, lab_tests,
  lab_test_parameters, stock_items from hos_app;
revoke update on stock_movements from hos_app;
