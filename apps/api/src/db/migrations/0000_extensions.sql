-- 0000: PostgreSQL extensions used from phase 1.2 onwards, plus schema metadata. No tables.
-- Migration tracking (schema_migrations) is created by the runner before this file runs.
-- All four extensions are "trusted", so the database owner (hos_owner) can create them without
-- superuser rights.
create extension if not exists pgcrypto;   -- gen_random_uuid(), digests
create extension if not exists citext;     -- case-insensitive usernames and emails
create extension if not exists pg_trgm;    -- fuzzy patient name search
create extension if not exists btree_gist; -- EXCLUDE constraints (no double booking)

comment on schema public is 'HospitalOS Mobile application schema. Owned by hos_owner; changed only by forward-only migrations.';
