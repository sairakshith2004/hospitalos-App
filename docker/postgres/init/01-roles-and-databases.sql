-- HospitalOS Mobile: project databases and least-privilege roles.
-- Run by scripts/db-init.sh as the container superuser, ONLY inside the hospitalos-mobile
-- container. It is NOT mounted as a container start-up script.
--
-- Safe to re-run:
--   * nothing exists yet        -> create roles and databases, then apply privileges;
--   * everything already exists -> change nothing except re-applying the same privileges;
--   * only some of it exists, or a reference-named (hms_*) database is present -> stop with an
--     error and change nothing.
-- Passwords come from environment variables via \getenv; they never appear in this file or on a
-- command line, and an existing role's password is never changed.
\set ON_ERROR_STOP on

\getenv owner_pw HOS_OWNER_PASSWORD
\getenv app_pw HOS_APP_PASSWORD

select
  (roles = 0 and dbs = 0) as fresh,
  (roles = 2 and dbs = 2) as complete,
  (reference_dbs > 0) as has_reference
from (
  select
    (select count(*) from pg_roles where rolname in ('hos_owner', 'hos_app')) as roles,
    (select count(*) from pg_database where datname in ('hospitalos_dev', 'hospitalos_test')) as dbs,
    (select count(*) from pg_database where datname like 'hms\_%') as reference_dbs
) as state
\gset

\if :has_reference
  do $$ begin raise exception 'A reference-named (hms_*) database exists in this cluster. This is not the HospitalOS Mobile container; nothing was changed.'; end $$;
\endif

\if :fresh
  \if :{?owner_pw}
  \else
    do $$ begin raise exception 'HOS_OWNER_PASSWORD is not set'; end $$;
  \endif
  \if :{?app_pw}
  \else
    do $$ begin raise exception 'HOS_APP_PASSWORD is not set'; end $$;
  \endif

  -- hos_owner owns the databases and runs migrations. hos_app is what the API connects as.
  -- Neither can act as superuser, create roles or databases, replicate, or bypass row security.
  create role hos_owner login password :'owner_pw'
    nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  create role hos_app login password :'app_pw'
    nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit;

  create database hospitalos_dev owner hos_owner encoding 'UTF8' template template0;
  create database hospitalos_test owner hos_owner encoding 'UTF8' template template0;
  \echo 'created roles hos_owner, hos_app and databases hospitalos_dev, hospitalos_test'
\elif :complete
  \echo 'roles and databases already exist: verifying and re-applying privileges only'
\else
  do $$ begin raise exception 'Partial initialization found: some HospitalOS Mobile roles or databases exist and others do not. Nothing was changed; inspect before continuing.'; end $$;
\endif

-- Verify identities before granting anything.
do $$
declare
  bad integer;
begin
  select count(*) into bad from pg_roles
   where rolname in ('hos_owner', 'hos_app')
     and (rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls);
  if bad > 0 then
    raise exception 'hos_owner or hos_app has elevated attributes; refusing to continue';
  end if;
  select count(*) into bad from pg_database d join pg_roles r on r.oid = d.datdba
   where d.datname in ('hospitalos_dev', 'hospitalos_test') and r.rolname <> 'hos_owner';
  if bad > 0 then
    raise exception 'hospitalos_dev or hospitalos_test is not owned by hos_owner; refusing to continue';
  end if;
end
$$;

revoke all on database hospitalos_dev from public;
revoke all on database hospitalos_test from public;
grant connect on database hospitalos_dev to hos_app;
grant connect on database hospitalos_test to hos_app;

-- Same schema rules in both databases. hos_owner owns the public schema; only hos_owner can
-- create objects there. Tables and sequences hos_owner creates later: hos_app may read, add and
-- update rows. No DELETE by default: clinical, financial and audit history is never deleted by
-- the app. The migration runner limits schema_migrations to read-only for hos_app.
\connect hospitalos_dev
alter schema public owner to hos_owner;
revoke all on schema public from public;
grant usage on schema public to hos_app;
alter default privileges for role hos_owner in schema public
  grant select, insert, update on tables to hos_app;
alter default privileges for role hos_owner in schema public
  grant usage, select on sequences to hos_app;

\connect hospitalos_test
alter schema public owner to hos_owner;
revoke all on schema public from public;
grant usage on schema public to hos_app;
alter default privileges for role hos_owner in schema public
  grant select, insert, update on tables to hos_app;
alter default privileges for role hos_owner in schema public
  grant usage, select on sequences to hos_app;

\echo 'privileges applied to hospitalos_dev and hospitalos_test'
