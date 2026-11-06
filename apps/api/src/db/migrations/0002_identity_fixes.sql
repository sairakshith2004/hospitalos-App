-- 0002: fixes to 0001 (forward-only; 0001 is never edited).
-- ensure_active_super_admin() referenced old.role_id in one expression for both tables it guards,
-- which fails when it fires for users (no role_id column). Same rule, table-specific branches.
create or replace function ensure_active_super_admin() returns trigger language plpgsql as $$
declare
  sa_role uuid := (select id from roles where code = 'SA');
begin
  -- Only removals that touch a Super Admin matter: an SA grant deleted, or an SA holder disabled.
  if tg_table_name = 'user_roles' then
    if (to_jsonb(old) ->> 'role_id')::uuid is distinct from sa_role then
      return null;
    end if;
  else
    if not exists (select 1 from user_roles where user_id = (to_jsonb(old) ->> 'id')::uuid and role_id = sa_role) then
      return null;
    end if;
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
