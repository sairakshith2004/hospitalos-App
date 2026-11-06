import { passwordSchema, usernameSchema } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { systemActor, writeAudit } from '../audit';
import { maybeOne, one, run, transaction, type Db } from '../db/sql';
import { SUPER_ADMIN_LOCK } from '../modules/admin/staff.service';
import { revokeSessions } from '../modules/auth/auth.service';

import { hashPassword } from './crypto';

/**
 * Operator actions run on the server with hos_owner credentials (architecture §6.3). They take
 * secrets only from an interactive prompt, never from arguments or the environment, and print none.
 */
export const bootstrapInputSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(1).max(120),
  email: z.email().max(254).optional(),
  password: passwordSchema,
  mustChangePassword: z.boolean(),
});
export type BootstrapInput = z.infer<typeof bootstrapInputSchema>;

/** Creates the first Super Admin. Refuses while any active Super Admin exists. */
export async function bootstrapSuperAdmin(
  db: Db,
  input: BootstrapInput,
  operator: string,
): Promise<string> {
  const parsed = bootstrapInputSchema.parse(input);
  const hash = await hashPassword(parsed.password);
  return transaction(db, async (tx) => {
    // Serialize concurrent bootstraps and Super Admin changes (same lock as staff administration).
    await run(tx, sql`select pg_advisory_xact_lock(${SUPER_ADMIN_LOCK})`);
    const existing = await maybeOne(
      tx,
      sql`select 1 as found from user_roles ur join roles r on r.id = ur.role_id and r.code = 'SA'
            join users u on u.id = ur.user_id and u.status = 'active' limit 1`,
      z.object({ found: z.number() }),
    );
    if (existing)
      throw new Error(
        'An active Super Admin already exists. Bootstrap refused; nothing was changed.',
      );
    const department = await one(
      tx,
      sql`select id from departments where code = 'ADMIN'`,
      z.object({ id: z.uuid() }),
    );
    const employee = await one(
      tx,
      sql`insert into employees (employee_no, full_name, department_id, designation, email)
          values (${`SA-${Date.now().toString(36).toUpperCase()}`}, ${parsed.fullName}, ${department.id},
                  'Super Admin', ${parsed.email ?? null})
          returning id`,
      z.object({ id: z.uuid() }),
    );
    const user = await one(
      tx,
      sql`insert into users (employee_id, username, password_hash, must_change_password)
          values (${employee.id}, ${parsed.username}, ${hash}, ${parsed.mustChangePassword})
          returning id`,
      z.object({ id: z.uuid() }),
    );
    await run(
      tx,
      sql`insert into user_roles (user_id, role_id) select ${user.id}, id from roles where code = 'SA'`,
    );
    await writeAudit(
      tx,
      systemActor(`operator:${operator}`),
      {},
      {
        action: 'user.bootstrap_created',
        entityType: 'user',
        entityId: user.id,
        changes: { username: parsed.username, role: 'SA', hasEmail: parsed.email !== undefined },
      },
    );
    return user.id;
  });
}

/** Sets a new password for any account, ends every session and clears lockouts. */
export async function operatorResetPassword(
  db: Db,
  username: string,
  password: string,
  mustChangePassword: boolean,
  operator: string,
): Promise<void> {
  const parsedPassword = passwordSchema.parse(password);
  const hash = await hashPassword(parsedPassword);
  await transaction(db, async (tx) => {
    const user = await maybeOne(
      tx,
      sql`select id from users where username = ${username} for update`,
      z.object({ id: z.uuid() }),
    );
    if (!user) throw new Error('No account has that username. Nothing was changed.');
    await run(
      tx,
      sql`update users set password_hash = ${hash}, must_change_password = ${mustChangePassword},
                 password_changed_at = now() where id = ${user.id}`,
    );
    await revokeSessions(tx, user.id, 'operator_reset');
    await run(
      tx,
      sql`update login_lockouts set failed_logins = 0, locked_until = null where user_id = ${user.id}`,
    );
    await writeAudit(
      tx,
      systemActor(`operator:${operator}`),
      {},
      {
        action: 'user.password_reset',
        entityType: 'user',
        entityId: user.id,
      },
    );
  });
}
