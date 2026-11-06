import { PERMISSIONS, ROLE_CODES, ROLE_NAMES, ROLE_PERMISSIONS } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { many, run, transaction, type Db } from '../db/sql';

/**
 * Seeds the access model from packages/contracts (architecture §6.3): the 11 roles, the 88
 * permissions and the exact role grants, in every environment. Idempotent. It never deletes: if the
 * database holds a permission or grant the contracts don't, it stops and names the difference.
 */
export async function seedAccessModel(
  db: Db,
): Promise<{ roles: number; permissions: number; grants: number }> {
  return transaction(db, async (tx) => {
    for (const code of ROLE_CODES) {
      await run(
        tx,
        sql`insert into roles (code, name) values (${code}, ${ROLE_NAMES[code]})
            on conflict (code) do nothing`,
      );
    }
    for (const code of PERMISSIONS) {
      await run(
        tx,
        sql`insert into permissions (code) values (${code}) on conflict (code) do nothing`,
      );
    }
    for (const role of ROLE_CODES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        await run(
          tx,
          sql`insert into role_permissions (role_id, permission_id)
              select r.id, p.id from roles r, permissions p where r.code = ${role} and p.code = ${permission}
              on conflict do nothing`,
        );
      }
    }

    const extraPermissions = await many(
      tx,
      sql`select code from permissions where code not in ${[...PERMISSIONS]}`,
      z.object({ code: z.string() }),
    );
    const grants = await many(
      tx,
      sql`select r.code as role, p.code as permission from role_permissions rp
            join roles r on r.id = rp.role_id join permissions p on p.id = rp.permission_id`,
      z.object({ role: z.string(), permission: z.string() }),
    );
    const expected = new Set(
      ROLE_CODES.flatMap((role) => ROLE_PERMISSIONS[role].map((p) => `${role}:${p}`)),
    );
    const extraGrants = grants.filter((g) => !expected.has(`${g.role}:${g.permission}`));
    if (extraPermissions.length > 0 || extraGrants.length > 0) {
      throw new Error(
        `The database access model differs from packages/contracts (extra permissions: ${extraPermissions.length}, extra grants: ${extraGrants.length}). Nothing was deleted; resolve it with an approved migration.`,
      );
    }
    return { roles: ROLE_CODES.length, permissions: PERMISSIONS.length, grants: grants.length };
  });
}

/** Departments every installation needs before the first account exists. */
export async function seedBaseDepartments(db: Db): Promise<void> {
  await run(
    db,
    sql`insert into departments (code, name, is_clinical) values ('ADMIN', 'Administration', false)
        on conflict (code) do nothing`,
  );
}
