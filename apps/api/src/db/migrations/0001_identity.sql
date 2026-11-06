-- 0001: identity, access control, settings, audit, sessions, password reset (phase 1.2).
-- Design follows the reference schema (read-only reference) and docs/MOBILE-ARCHITECTURE.md §4–§5.
-- Forward-only: never edit after it has been applied anywhere.
--
-- Privileges: hos_owner's default privileges give hos_app SELECT, INSERT, UPDATE on every new
-- table (docker/postgres/init). Each table below then narrows that explicitly.

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create function reject_change() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Hospital settings: one row. Security limits carry their approved ranges as CHECKs (§5.6).
-- ---------------------------------------------------------------------------------------------
create table hospital_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null check (length(trim(name)) > 0),
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  near_expiry_days integer not null default 30 check (near_expiry_days between 0 and 365),
  care_window_before_days integer not null default 7 check (care_window_before_days between 0 and 365),
  care_window_after_days integer not null default 90 check (care_window_after_days between 0 and 365),
  follow_up_grace_days integer not null default 7 check (follow_up_grace_days between 0 and 365),
  prescription_validity_days integer not null default 30 check (prescription_validity_days between 1 and 365),
  access_token_minutes integer not null default 15 check (access_token_minutes between 5 and 15),
  session_idle_minutes integer not null default 30 check (session_idle_minutes between 5 and 60),
  session_absolute_hours integer not null default 12 check (session_absolute_hours between 1 and 12),
  login_lockout_failures integer not null default 5 check (login_lockout_failures between 3 and 10),
  login_lockout_minutes integer not null default 15 check (login_lockout_minutes between 5 and 60),
  login_max_failures_per_ip integer not null default 10 check (login_max_failures_per_ip between 3 and 10),
  password_reset_code_minutes integer not null default 15 check (password_reset_code_minutes between 5 and 15),
  password_reset_max_requests_per_account_hour integer not null default 3
    check (password_reset_max_requests_per_account_hour between 1 and 3),
  password_reset_max_requests_per_ip_hour integer not null default 10
    check (password_reset_max_requests_per_ip_hour between 1 and 10),
  password_reset_max_attempts_per_code integer not null default 5
    check (password_reset_max_attempts_per_code between 1 and 5),
  app_min_version_android text check (app_min_version_android ~ '^\d+\.\d+\.\d+$'),
  app_min_version_ios text check (app_min_version_ios ~ '^\d+\.\d+\.\d+$'),
  app_latest_version_android text check (app_latest_version_android ~ '^\d+\.\d+\.\d+$'),
  app_latest_version_ios text check (app_latest_version_ios ~ '^\d+\.\d+\.\d+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into hospital_settings (name) values ('HospitalOS Outpatient Hospital');
create trigger hospital_settings_updated_at before update on hospital_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Departments, employees, users
-- ---------------------------------------------------------------------------------------------
create table departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_-]{1,19}$'),
  name text not null unique check (length(trim(name)) > 0),
  is_clinical boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create trigger departments_updated_at before update on departments
  for each row execute function set_updated_at();

create table employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null unique check (employee_no ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  department_id uuid not null references departments (id) on delete restrict,
  designation text not null check (length(trim(designation)) between 1 and 80),
  email citext check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  employment_status text not null default 'active' check (employment_status in ('active', 'on_leave', 'exited')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);
create unique index employees_email_key on employees (email) where email is not null;
create index employees_department_idx on employees (department_id);
create trigger employees_updated_at before update on employees
  for each row execute function set_updated_at();

create table users (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references employees (id) on delete restrict,
  username citext not null unique check (username ~ '^[a-z0-9][a-z0-9._-]{2,39}$'),
  password_hash text not null check (password_hash like '$argon2id$%'),
  status text not null default 'active' check (status in ('active', 'disabled')),
  must_change_password boolean not null default false,
  is_demo boolean not null default false,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references users (id) on delete restrict,
  updated_by uuid references users (id) on delete restrict
);
create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

alter table departments
  add constraint departments_created_by_fk foreign key (created_by) references users (id) on delete restrict,
  add constraint departments_updated_by_fk foreign key (updated_by) references users (id) on delete restrict;
alter table employees
  add constraint employees_created_by_fk foreign key (created_by) references users (id) on delete restrict,
  add constraint employees_updated_by_fk foreign key (updated_by) references users (id) on delete restrict;
alter table hospital_settings
  add constraint hospital_settings_updated_by_fk foreign key (updated_by) references users (id) on delete restrict;

-- ---------------------------------------------------------------------------------------------
-- Roles and permissions: reference data, seeded from packages/contracts by `npm run db:seed`.
-- hos_app may only read them; role grants to users are the only part the API changes.
-- ---------------------------------------------------------------------------------------------
create table roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]{1,19}$'),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]+:[a-z_]+$'),
  created_at timestamptz not null default now()
);

create table role_permissions (
  role_id uuid not null references roles (id) on delete restrict,
  permission_id uuid not null references permissions (id) on delete restrict,
  primary key (role_id, permission_id)
);
create index role_permissions_permission_idx on role_permissions (permission_id);

create table user_roles (
  user_id uuid not null references users (id) on delete restrict,
  role_id uuid not null references roles (id) on delete restrict,
  granted_by uuid references users (id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id),
  constraint user_roles_no_self_grant check (granted_by is null or granted_by <> user_id)
);
create index user_roles_role_idx on user_roles (role_id);

-- The last active Super Admin can never lose the role or be disabled (checked at commit, so a
-- transaction that grants a new SA before removing the old one is fine).
create function ensure_active_super_admin() returns trigger language plpgsql as $$
declare
  sa_role uuid := (select id from roles where code = 'SA');
begin
  -- Only removals that touch a Super Admin matter: an SA grant deleted, or an SA holder disabled.
  if tg_table_name = 'user_roles' and old.role_id is distinct from sa_role then
    return null;
  end if;
  if tg_table_name = 'users'
     and not exists (select 1 from user_roles where user_id = old.id and role_id = sa_role) then
    return null;
  end if;
  if not exists (
    select 1 from user_roles ur
      join users u on u.id = ur.user_id and u.status = 'active'
     where ur.role_id = sa_role
  ) then
    raise exception 'the last active Super Admin cannot be removed or disabled'
      using errcode = 'check_violation';
  end if;
  return null;
end
$$;
create constraint trigger user_roles_keep_super_admin after delete on user_roles
  deferrable initially deferred for each row execute function ensure_active_super_admin();
create constraint trigger users_keep_super_admin after update of status on users
  deferrable initially deferred for each row
  when (old.status = 'active' and new.status <> 'active')
  execute function ensure_active_super_admin();

-- ---------------------------------------------------------------------------------------------
-- Audit log: append-only for every role, including its owner.
-- ---------------------------------------------------------------------------------------------
create table audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('user', 'system')),
  actor_user_id uuid references users (id) on delete restrict,
  actor_label text check (actor_label is null or length(actor_label) <= 120),
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type text not null,
  entity_id text,
  patient_id uuid,
  request_id text,
  ip text check (ip is null or length(ip) <= 64),
  changes jsonb,
  reason text check (reason is null or length(reason) <= 1000),
  constraint audit_logs_actor_matches_type check ((actor_type = 'system') = (actor_user_id is null))
);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on audit_logs (actor_user_id, occurred_at);
create index audit_logs_action_idx on audit_logs (action, occurred_at);
create index audit_logs_patient_idx on audit_logs (patient_id, occurred_at) where patient_id is not null;
create trigger audit_logs_no_update_delete before update or delete on audit_logs
  for each row execute function reject_change();
create trigger audit_logs_no_truncate before truncate on audit_logs
  for each statement execute function reject_change();

-- ---------------------------------------------------------------------------------------------
-- Sessions and tokens (architecture §5.2–5.3). One session = one token family.
-- Only SHA-256 hashes of tokens are stored.
-- ---------------------------------------------------------------------------------------------
create table auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  device_label text not null check (length(trim(device_label)) between 1 and 80),
  platform text check (platform is null or platform in ('android', 'ios', 'web')),
  app_version text check (app_version is null or app_version ~ '^\d+\.\d+\.\d+$'),
  ip text check (ip is null or length(ip) <= 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  idle_expires_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text check (revoke_reason is null or revoke_reason in (
    'logout', 'logout_all', 'password_changed', 'password_reset', 'account_disabled',
    'refresh_reuse', 'role_changed', 'operator_reset', 'user_revoked')),
  constraint auth_sessions_revocation_complete check ((revoked_at is null) = (revoke_reason is null)),
  constraint auth_sessions_expiry_order check (idle_expires_at <= absolute_expires_at)
);
create index auth_sessions_user_idx on auth_sessions (user_id) where revoked_at is null;

create table auth_tokens (
  id bigint generated always as identity primary key,
  session_id uuid not null references auth_sessions (id) on delete restrict,
  kind text not null check (kind in ('access', 'refresh')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint auth_tokens_access_never_used check (kind = 'refresh' or used_at is null),
  constraint auth_tokens_expiry_after_creation check (expires_at > created_at)
);
create index auth_tokens_session_idx on auth_tokens (session_id);

-- A refresh token is only ever marked used, once; nothing else about a token changes.
create function auth_tokens_enforce() returns trigger language plpgsql as $$
begin
  if old.used_at is not null then
    raise exception 'a used refresh token cannot change' using errcode = 'check_violation';
  end if;
  if (to_jsonb(new) - 'used_at') <> (to_jsonb(old) - 'used_at') then
    raise exception 'only the use of a token can be recorded' using errcode = 'check_violation';
  end if;
  return new;
end
$$;
create trigger auth_tokens_enforce before update on auth_tokens
  for each row execute function auth_tokens_enforce();

-- ---------------------------------------------------------------------------------------------
-- Sign-in protection: per-IP failure counting and per-account-per-IP lockouts (§5.3).
-- ---------------------------------------------------------------------------------------------
create table login_attempts (
  id bigint generated always as identity primary key,
  user_id uuid references users (id) on delete restrict,
  ip text not null check (length(ip) between 1 and 64),
  succeeded boolean not null,
  occurred_at timestamptz not null default now()
);
create index login_attempts_ip_idx on login_attempts (ip, occurred_at) where not succeeded;
create trigger login_attempts_append_only before update or delete on login_attempts
  for each row execute function reject_change();

create table login_lockouts (
  user_id uuid not null references users (id) on delete restrict,
  ip text not null check (length(ip) between 1 and 64),
  failed_logins integer not null default 0 check (failed_logins >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, ip)
);
create trigger login_lockouts_updated_at before update on login_lockouts
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Password reset by one-time code (§5.4). Only an HMAC of (user, code) is stored.
-- ---------------------------------------------------------------------------------------------
create table password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  code_hmac text not null check (code_hmac ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  used_at timestamptz,
  invalidated_at timestamptz,
  constraint password_reset_codes_expiry_after_creation check (expires_at > created_at),
  constraint password_reset_codes_single_end check (used_at is null or invalidated_at is null)
);
create index password_reset_codes_user_idx on password_reset_codes (user_id, created_at);

-- Every request is counted, for known and unknown identifiers alike. The identifier is stored
-- only as a keyed hash, so unknown identifiers are counted but never stored.
create table password_reset_requests (
  id bigint generated always as identity primary key,
  identifier_hmac text not null check (identifier_hmac ~ '^[0-9a-f]{64}$'),
  ip text not null check (length(ip) between 1 and 64),
  requested_at timestamptz not null default now()
);
create index password_reset_requests_identifier_idx on password_reset_requests (identifier_hmac, requested_at);
create index password_reset_requests_ip_idx on password_reset_requests (ip, requested_at);
create trigger password_reset_requests_append_only before update or delete on password_reset_requests
  for each row execute function reject_change();

-- ---------------------------------------------------------------------------------------------
-- Idempotency keys (architecture §4): a replay returns the stored result; reuse of a key with a
-- different request body is refused.
-- ---------------------------------------------------------------------------------------------
create table idempotency_keys (
  user_id uuid not null references users (id) on delete restrict,
  key uuid not null,
  scope text not null check (length(scope) between 1 and 80),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_status integer not null check (response_status between 200 and 599),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);
create trigger idempotency_keys_append_only before update or delete on idempotency_keys
  for each row execute function reject_change();

-- ---------------------------------------------------------------------------------------------
-- hos_app privileges, narrowed table by table.
-- ---------------------------------------------------------------------------------------------
revoke insert on hospital_settings from hos_app;
revoke insert, update on roles, permissions, role_permissions from hos_app;
grant delete on user_roles to hos_app;
revoke update on audit_logs, login_attempts, password_reset_requests, idempotency_keys from hos_app;
