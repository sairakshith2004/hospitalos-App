import { isPermission, isRoleCode, type Permission, type RoleCode } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { many, type Executor } from '../db/sql';

/** A user's roles and permissions, always read fresh from the database (architecture §5.1). */
export async function loadGrants(
  db: Executor,
  userId: string,
): Promise<{ roles: RoleCode[]; permissions: Permission[] }> {
  const roleRows = await many(
    db,
    sql`select r.code from user_roles ur join roles r on r.id = ur.role_id
         where ur.user_id = ${userId} order by r.code`,
    z.object({ code: z.string() }),
  );
  const permissionRows = await many(
    db,
    sql`select distinct p.code from user_roles ur
          join role_permissions rp on rp.role_id = ur.role_id
          join permissions p on p.id = rp.permission_id
         where ur.user_id = ${userId} order by p.code`,
    z.object({ code: z.string() }),
  );
  return {
    roles: roleRows.map((row) => row.code).filter(isRoleCode),
    permissions: permissionRows.map((row) => row.code).filter(isPermission),
  };
}
