import { randomBytes } from 'node:crypto';

import { ROLE_CODES, ROLE_NAMES, type RoleCode } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { systemActor, writeAudit } from '../audit';
import { hashPassword } from '../auth/crypto';
import { maybeOne, one, run, transaction, type Db } from '../db/sql';

/** Department each demo role belongs to (departments come from the reference-data seed). */
const DEMO_DEPARTMENT: Readonly<Record<RoleCode, string>> = {
  SA: 'ADMIN',
  ADM: 'ADMIN',
  HR: 'ADMIN',
  REC: 'ADMIN',
  FIN: 'ADMIN',
  INV: 'ADMIN',
  MKT: 'ADMIN',
  DOC: 'GENMED',
  NUR: 'GENMED',
  PHA: 'PHARMACY',
  LAB: 'LAB',
};

export type DemoCredential = Readonly<{ role: RoleCode; username: string; password: string }>;

/**
 * One demo account per role, for development and test databases only (architecture §6.3, ACC-4).
 * Every run gives each account a new random password, stores only its hash and returns the
 * plaintext once for the operator's terminal. Accounts are flagged `is_demo`.
 */
export async function seedDemoAccounts(
  db: Db,
  nodeEnv: string | undefined,
): Promise<DemoCredential[]> {
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      'Demo accounts exist only in development and test (NODE_ENV). Nothing was changed.',
    );
  }
  const database = await one(
    db,
    sql`select current_database() as name`,
    z.object({ name: z.string() }),
  );
  if (database.name !== 'hospitalos_dev' && database.name !== 'hospitalos_test') {
    throw new Error('Demo accounts are refused outside hospitalos_dev and hospitalos_test.');
  }
  const credentials: DemoCredential[] = [];
  for (const role of ROLE_CODES) {
    const username = `demo-${role.toLowerCase()}`;
    const password = randomBytes(18).toString('base64url');
    const hash = await hashPassword(password);
    await transaction(db, async (tx) => {
      const department = await maybeOne(
        tx,
        sql`select id from departments where code = ${DEMO_DEPARTMENT[role]}`,
        z.object({ id: z.uuid() }),
      );
      const departmentId =
        department?.id ??
        (
          await one(
            tx,
            sql`select id from departments where code = 'ADMIN'`,
            z.object({ id: z.uuid() }),
          )
        ).id;
      const existing = await maybeOne(
        tx,
        sql`select id from users where username = ${username}`,
        z.object({ id: z.uuid() }),
      );
      let userId: string;
      if (existing) {
        userId = existing.id;
        await run(
          tx,
          sql`update users set password_hash = ${hash}, must_change_password = false, status = 'active',
                     is_demo = true, password_changed_at = now() where id = ${userId}`,
        );
        await run(
          tx,
          sql`update auth_sessions set revoked_at = now(), revoke_reason = 'operator_reset'
                          where user_id = ${userId} and revoked_at is null`,
        );
      } else {
        const employee = await one(
          tx,
          sql`insert into employees (employee_no, full_name, department_id, designation, email)
              values (${`DEMO-${role}`}, ${`Demo ${ROLE_NAMES[role]}`}, ${departmentId}, ${ROLE_NAMES[role]},
                      ${`${username}@hospitalos.invalid`})
              returning id`,
          z.object({ id: z.uuid() }),
        );
        userId = (
          await one(
            tx,
            sql`insert into users (employee_id, username, password_hash, is_demo)
                values (${employee.id}, ${username}, ${hash}, true) returning id`,
            z.object({ id: z.uuid() }),
          )
        ).id;
      }
      await run(
        tx,
        sql`insert into user_roles (user_id, role_id) select ${userId}, id from roles where code = ${role}
            on conflict do nothing`,
      );
      if (role === 'DOC') {
        // The demo doctor sees patients: give them a synthetic doctor profile and daily hours.
        const profile = await maybeOne(
          tx,
          sql`select dp.id from doctor_profiles dp join users u on u.employee_id = dp.employee_id where u.id = ${userId}`,
          z.object({ id: z.uuid() }),
        );
        if (!profile) {
          const created = await one(
            tx,
            sql`insert into doctor_profiles (employee_id, department_id, specialty, registration_no, default_slot_minutes, consultation_fee_paise)
                select u.employee_id, e.department_id, 'General Medicine', 'SYN-REG-DEMO', 15, 50000
                  from users u join employees e on e.id = u.employee_id where u.id = ${userId}
                returning id`,
            z.object({ id: z.uuid() }),
          );
          for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
            await run(
              tx,
              sql`insert into doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes, valid_from)
                  values (${created.id}, ${weekday}, '08:00'::time, '20:00'::time, 15, date '2026-01-01')`,
            );
          }
        }
      }
      await writeAudit(
        tx,
        systemActor('seed:demo'),
        {},
        {
          action: 'user.demo_seeded',
          entityType: 'user',
          entityId: userId,
          changes: { role },
        },
      );
    });
    credentials.push({ role, username, password });
  }
  return credentials;
}
