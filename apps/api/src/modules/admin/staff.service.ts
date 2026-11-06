import {
  isRoleCode,
  PERMISSIONS,
  ROLE_CODES,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  type RoleCode,
  type StaffSummary,
} from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
import { hashPassword } from '../../auth/crypto';
import {
  many,
  maybeOne,
  one,
  PG,
  postgresErrorOf,
  run,
  timestamptz,
  transaction,
  type Db,
  type Executor,
} from '../../db/sql';
import type { AuthContext, RequestMeta } from '../../http/context';
import { AppError } from '../../lib/errors';
import { revokeSessions } from '../auth/auth.service';

const staffRow = z.object({
  id: z.uuid(),
  username: z.string(),
  full_name: z.string(),
  employee_no: z.string(),
  department_code: z.string(),
  designation: z.string(),
  email: z.string().nullable(),
  status: z.enum(['active', 'disabled']),
  must_change_password: z.boolean(),
  created_at: timestamptz,
  roles: z.array(z.string()).nullable(),
});

const STAFF_SELECT = sql`select u.id, u.username::text as username, e.full_name, e.employee_no,
      d.code as department_code, e.designation, e.email::text as email, u.status,
      u.must_change_password, u.created_at,
      (select array_agg(r.code order by r.code) from user_roles ur join roles r on r.id = ur.role_id
        where ur.user_id = u.id) as roles
  from users u join employees e on e.id = u.employee_id join departments d on d.id = e.department_id`;

function toSummary(row: z.infer<typeof staffRow>): StaffSummary {
  return {
    id: row.id,
    username: row.username,
    fullName: row.full_name,
    employeeNo: row.employee_no,
    departmentCode: row.department_code,
    designation: row.designation,
    email: row.email,
    status: row.status,
    roles: (row.roles ?? []).filter(isRoleCode),
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
  };
}

const notFound = () => new AppError(404, 'NOT_FOUND', 'Not found.');
const unprocessable = (message: string) => new AppError(422, 'UNPROCESSABLE', message);

/**
 * Serializes every change that could remove the last active Super Admin (otherwise two admins
 * removing two different SAs at once could each see the other still active). A transaction-scoped
 * advisory lock: released at commit or rollback, and it needs no table privileges.
 */
export const SUPER_ADMIN_LOCK = 4_040_011;
async function lockSuperAdminRole(tx: Executor): Promise<string> {
  await run(tx, sql`select pg_advisory_xact_lock(${SUPER_ADMIN_LOCK})`);
  const role = await one(
    tx,
    sql`select id from roles where code = 'SA'`,
    z.object({ id: z.uuid() }),
  );
  return role.id;
}

function mapConstraint(error: unknown): never {
  const pg = postgresErrorOf(error);
  if (pg?.code === PG.uniqueViolation) {
    const field = pg.constraint?.includes('username')
      ? 'username'
      : pg.constraint?.includes('email')
        ? 'email'
        : 'employeeNo';
    throw new AppError(409, 'CONFLICT', 'That value is already in use.', [
      { path: field, message: 'Already in use.' },
    ]);
  }
  if (pg?.code === PG.checkViolation && pg.constraint === undefined) {
    throw new AppError(409, 'CONFLICT', 'The last active Super Admin cannot lose access.');
  }
  throw error;
}

export type CreateStaffInput = Readonly<{
  fullName: string;
  employeeNo: string;
  departmentCode: string;
  designation: string;
  username: string;
  email?: string | undefined;
  temporaryPassword: string;
}>;

export function createStaffService(db: Db) {
  async function get(userId: string): Promise<StaffSummary> {
    const row = await maybeOne(db, sql`${STAFF_SELECT} where u.id = ${userId}`, staffRow);
    if (!row) throw notFound();
    return toSummary(row);
  }

  return {
    get,

    async list(): Promise<StaffSummary[]> {
      const rows = await many(
        db,
        sql`${STAFF_SELECT} order by e.full_name, u.username limit 500`,
        staffRow,
      );
      return rows.map(toSummary);
    },

    async create(
      actor: AuthContext,
      input: CreateStaffInput,
      meta: RequestMeta,
    ): Promise<StaffSummary> {
      const hash = await hashPassword(input.temporaryPassword);
      const userId = await transaction(db, async (tx) => {
        const department = await maybeOne(
          tx,
          sql`select id from departments where code = ${input.departmentCode} and active`,
          z.object({ id: z.uuid() }),
        );
        if (!department) {
          throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
            { path: 'departmentCode', message: 'No active department has this code.' },
          ]);
        }
        try {
          const employee = await one(
            tx,
            sql`insert into employees (employee_no, full_name, department_id, designation, email, created_by, updated_by)
                values (${input.employeeNo}, ${input.fullName}, ${department.id}, ${input.designation},
                        ${input.email ?? null}, ${actor.userId}, ${actor.userId})
                returning id`,
            z.object({ id: z.uuid() }),
          );
          const user = await one(
            tx,
            sql`insert into users (employee_id, username, password_hash, must_change_password, created_by, updated_by)
                values (${employee.id}, ${input.username}, ${hash}, true, ${actor.userId}, ${actor.userId})
                returning id`,
            z.object({ id: z.uuid() }),
          );
          await writeAudit(tx, userActor(actor.userId), meta, {
            action: 'user.created',
            entityType: 'user',
            entityId: user.id,
            changes: {
              username: input.username,
              employeeNo: input.employeeNo,
              departmentCode: input.departmentCode,
              hasEmail: input.email !== undefined,
            },
          });
          return user.id;
        } catch (error) {
          mapConstraint(error);
        }
      });
      return get(userId);
    },

    async changeRole(
      actor: AuthContext,
      userId: string,
      role: RoleCode,
      action: 'grant' | 'revoke',
      reason: string,
      meta: RequestMeta,
    ): Promise<StaffSummary> {
      if (actor.userId === userId) throw unprocessable('You cannot change your own roles.');
      await transaction(db, async (tx) => {
        const saRoleId = await lockSuperAdminRole(tx);
        const target = await maybeOne(
          tx,
          sql`select id from users where id = ${userId} for update`,
          z.object({ id: z.uuid() }),
        );
        if (!target) throw notFound();
        const roleRow = await one(
          tx,
          sql`select id from roles where code = ${role}`,
          z.object({ id: z.uuid() }),
        );
        try {
          if (action === 'grant') {
            const inserted = await run(
              tx,
              sql`insert into user_roles (user_id, role_id, granted_by) values (${userId}, ${roleRow.id}, ${actor.userId})
                  on conflict do nothing`,
            );
            if (inserted === 0)
              throw new AppError(409, 'CONFLICT', 'The user already has this role.');
          } else {
            const removed = await run(
              tx,
              sql`delete from user_roles where user_id = ${userId} and role_id = ${roleRow.id}`,
            );
            if (removed === 0)
              throw new AppError(409, 'CONFLICT', 'The user does not have this role.');
            if (roleRow.id === saRoleId) {
              const remaining = await one(
                tx,
                sql`select count(*)::int as n from user_roles ur join users u on u.id = ur.user_id and u.status = 'active'
                     where ur.role_id = ${saRoleId}`,
                z.object({ n: z.number().int() }),
              );
              if (remaining.n === 0)
                throw new AppError(
                  409,
                  'CONFLICT',
                  'The last active Super Admin cannot lose access.',
                );
            }
            // Fewer privileges: end the user's sessions so nothing cached on a device outlives them.
            await revokeSessions(tx, userId, 'role_changed');
          }
          await writeAudit(tx, userActor(actor.userId), meta, {
            action: action === 'grant' ? 'user_role.granted' : 'user_role.revoked',
            entityType: 'user',
            entityId: userId,
            changes: { role },
            reason,
          });
        } catch (error) {
          if (error instanceof AppError) throw error;
          mapConstraint(error);
        }
      });
      return get(userId);
    },

    async setStatus(
      actor: AuthContext,
      userId: string,
      status: 'active' | 'disabled',
      reason: string,
      meta: RequestMeta,
    ): Promise<StaffSummary> {
      if (actor.userId === userId)
        throw unprocessable('You cannot change your own account status.');
      await transaction(db, async (tx) => {
        const saRoleId = await lockSuperAdminRole(tx);
        const target = await maybeOne(
          tx,
          sql`select u.status, exists (select 1 from user_roles where user_id = u.id and role_id = ${saRoleId}) as is_sa
                from users u where u.id = ${userId} for update`,
          z.object({ status: z.enum(['active', 'disabled']), is_sa: z.boolean() }),
        );
        if (!target) throw notFound();
        // An administrator who is not a Super Admin can't change a Super Admin's account.
        if (target.is_sa && !actor.roles.includes('SA'))
          throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
        if (target.status === status)
          throw new AppError(409, 'CONFLICT', `The account is already ${status}.`);
        if (status === 'disabled' && target.is_sa) {
          const others = await one(
            tx,
            sql`select count(*)::int as n from user_roles ur join users u on u.id = ur.user_id and u.status = 'active'
                 where ur.role_id = ${saRoleId} and u.id <> ${userId}`,
            z.object({ n: z.number().int() }),
          );
          if (others.n === 0)
            throw new AppError(409, 'CONFLICT', 'The last active Super Admin cannot lose access.');
        }
        await run(
          tx,
          sql`update users set status = ${status}, updated_by = ${actor.userId} where id = ${userId}`,
        );
        if (status === 'disabled') await revokeSessions(tx, userId, 'account_disabled');
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'user.status_changed',
          entityType: 'user',
          entityId: userId,
          changes: { from: target.status, to: status },
          reason,
        });
      });
      return get(userId);
    },

    roles() {
      return {
        items: ROLE_CODES.map((code) => ({
          code,
          name: ROLE_NAMES[code],
          permissions: [...ROLE_PERMISSIONS[code]],
        })),
      };
    },

    permissions() {
      return { items: [...PERMISSIONS] };
    },

    async authAudit() {
      return many(
        db,
        sql`select id::text as id, occurred_at, action, actor_user_id, actor_label, entity_type, entity_id, reason
              from audit_logs
             where action like 'auth.%' or action like 'user.%' or action like 'user_role.%'
             order by id desc limit 200`,
        z.object({
          id: z.string(),
          occurred_at: timestamptz,
          action: z.string(),
          actor_user_id: z.uuid().nullable(),
          actor_label: z.string().nullable(),
          entity_type: z.string(),
          entity_id: z.string().nullable(),
          reason: z.string().nullable(),
        }),
      );
    },
  };
}

export type StaffService = ReturnType<typeof createStaffService>;
