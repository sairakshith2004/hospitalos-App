import type { CurrentUser, SignInResponse, TokenPair } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { systemActor, userActor, writeAudit } from '../../audit';
import { loadGrants } from '../../auth/access';
import {
  dummyPasswordHash,
  hashPassword,
  hmacHex,
  newResetCode,
  newToken,
  sameHex,
  sha256Hex,
  verifyPassword,
} from '../../auth/crypto';
import {
  instant,
  maybeOne,
  nullableInstant,
  one,
  run,
  transaction,
  type Db,
  type Executor,
} from '../../db/sql';
import type { RequestMeta } from '../../http/context';
import { AppError } from '../../lib/errors';
import type { Logger } from '../../lib/logger';
import type { Mailer } from '../../mail/mailer';
import type { SettingsProvider } from '../../settings';

export type AuthServiceDeps = Readonly<{
  db: Db;
  settings: SettingsProvider;
  mailer: Mailer;
  resetCodePepper: string;
  logger: Logger;
}>;

export type ClientInfo = Readonly<{
  deviceLabel: string;
  platform: 'android' | 'ios' | 'web' | null;
  appVersion: string | null;
}>;

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'The username or password is not right.');
const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
const invalidResetCode = () =>
  new AppError(400, 'INVALID_RESET_CODE', 'The code is not valid. Request a new one if needed.');

const userRow = z.object({
  id: z.uuid(),
  username: z.string(),
  password_hash: z.string(),
  status: z.enum(['active', 'disabled']),
  must_change_password: z.boolean(),
  is_demo: z.boolean(),
  full_name: z.string(),
  employee_no: z.string(),
  designation: z.string(),
  department_code: z.string(),
  email: z.string().nullable(),
});
type UserRow = z.infer<typeof userRow>;

const USER_SELECT = sql`select u.id, u.username::text as username, u.password_hash, u.status,
      u.must_change_password, u.is_demo, e.full_name, e.employee_no, e.designation,
      d.code as department_code, e.email::text as email
  from users u
  join employees e on e.id = u.employee_id
  join departments d on d.id = e.department_id`;

async function findUserByUsername(db: Executor, username: string): Promise<UserRow | undefined> {
  return maybeOne(db, sql`${USER_SELECT} where u.username = ${username}`, userRow);
}

/** Username or work email, as typed on the forgot-password screen. */
async function findUserByIdentifier(
  db: Executor,
  identifier: string,
): Promise<UserRow | undefined> {
  return maybeOne(
    db,
    sql`${USER_SELECT} where u.username = ${identifier} or e.email = ${identifier} limit 1`,
    userRow,
  );
}

export async function currentUserOf(db: Executor, userId: string): Promise<CurrentUser> {
  const user = await one(db, sql`${USER_SELECT} where u.id = ${userId}`, userRow);
  const grants = await loadGrants(db, userId);
  return {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    employeeNo: user.employee_no,
    departmentCode: user.department_code,
    designation: user.designation,
    roles: grants.roles,
    permissions: grants.permissions,
    mustChangePassword: user.must_change_password,
    isDemo: user.is_demo,
  };
}

/** Revokes every live session of a user (optionally keeping one) and all their tokens with it. */
export async function revokeSessions(
  db: Executor,
  userId: string,
  reason: string,
  keepSessionId: string | null = null,
): Promise<number> {
  return run(
    db,
    sql`update auth_sessions set revoked_at = now(), revoke_reason = ${reason}
         where user_id = ${userId} and revoked_at is null
           and (${keepSessionId}::uuid is null or id <> ${keepSessionId}::uuid)`,
  );
}

async function issueTokens(
  db: Executor,
  sessionId: string,
  accessMinutes: number,
): Promise<TokenPair> {
  const accessToken = newToken('access');
  const refreshToken = newToken('refresh');
  const access = await one(
    db,
    sql`insert into auth_tokens (session_id, kind, token_hash, expires_at)
        select ${sessionId}, 'access', ${sha256Hex(accessToken)},
               least(now() + make_interval(mins => ${accessMinutes}), s.absolute_expires_at)
          from auth_sessions s where s.id = ${sessionId}
        returning expires_at`,
    z.object({ expires_at: instant }),
  );
  await run(
    db,
    sql`insert into auth_tokens (session_id, kind, token_hash, expires_at)
        select ${sessionId}, 'refresh', ${sha256Hex(refreshToken)}, s.absolute_expires_at
          from auth_sessions s where s.id = ${sessionId}`,
  );
  return { accessToken, refreshToken, accessExpiresAt: access.expires_at.toISOString() };
}

export function createAuthService(deps: AuthServiceDeps) {
  const { db, settings, mailer, resetCodePepper, logger } = deps;

  async function recordFailure(meta: RequestMeta, user: UserRow | undefined, why: string) {
    const limits = await settings.get();
    await transaction(db, async (tx) => {
      await run(
        tx,
        sql`insert into login_attempts (user_id, ip, succeeded) values (${user?.id ?? null}, ${meta.ip}, false)`,
      );
      if (user) {
        // Per account *and* IP, so a stranger can't lock the real user out from elsewhere.
        await run(
          tx,
          sql`insert into login_lockouts (user_id, ip, failed_logins) values (${user.id}, ${meta.ip}, 1)
              on conflict (user_id, ip) do update set failed_logins = login_lockouts.failed_logins + 1`,
        );
        await run(
          tx,
          sql`update login_lockouts
                 set locked_until = now() + make_interval(mins => ${limits.login_lockout_minutes}),
                     failed_logins = 0
               where user_id = ${user.id} and ip = ${meta.ip}
                 and failed_logins >= ${limits.login_lockout_failures}`,
        );
      }
      await writeAudit(tx, user ? userActor(user.id) : systemActor('anonymous'), meta, {
        action: 'auth.login.failed',
        entityType: 'user',
        entityId: user?.id ?? null,
        reason: why,
      });
    });
  }

  async function signIn(
    username: string,
    password: string,
    client: ClientInfo,
    meta: RequestMeta,
  ): Promise<SignInResponse> {
    const limits = await settings.get();
    const recentFailures = await one(
      db,
      sql`select count(*)::int as n from login_attempts
           where ip = ${meta.ip} and not succeeded and occurred_at > now() - interval '15 minutes'`,
      z.object({ n: z.number().int() }),
    );
    if (recentFailures.n >= limits.login_max_failures_per_ip) {
      await writeAudit(db, systemActor('anonymous'), meta, {
        action: 'auth.login.rate_limited',
        entityType: 'auth',
      });
      throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.');
    }

    const user = await findUserByUsername(db, username.trim().toLowerCase());
    if (!user) {
      await verifyPassword(password, await dummyPasswordHash()); // same timing as a real check
      await recordFailure(meta, undefined, 'unknown_username');
      throw invalidCredentials();
    }

    const lock = await maybeOne(
      db,
      sql`select 1 as locked from login_lockouts
           where user_id = ${user.id} and ip = ${meta.ip} and locked_until > now()`,
      z.object({ locked: z.number() }),
    );
    const passwordOk = await verifyPassword(password, user.password_hash);
    if (lock) {
      await writeAudit(db, userActor(user.id), meta, {
        action: 'auth.login.locked',
        entityType: 'user',
        entityId: user.id,
      });
      throw invalidCredentials();
    }
    if (!passwordOk) {
      await recordFailure(meta, user, 'wrong_password');
      throw invalidCredentials();
    }
    if (user.status !== 'active') {
      await recordFailure(meta, user, 'account_disabled');
      throw invalidCredentials();
    }

    return transaction(db, async (tx) => {
      const session = await one(
        tx,
        sql`insert into auth_sessions
              (user_id, device_label, platform, app_version, ip, idle_expires_at, absolute_expires_at)
            values (${user.id}, ${client.deviceLabel}, ${client.platform}, ${client.appVersion}, ${meta.ip},
                    least(now() + make_interval(mins => ${limits.session_idle_minutes}),
                          now() + make_interval(hours => ${limits.session_absolute_hours})),
                    now() + make_interval(hours => ${limits.session_absolute_hours}))
            returning id`,
        z.object({ id: z.uuid() }),
      );
      const tokens = await issueTokens(tx, session.id, limits.access_token_minutes);
      await run(
        tx,
        sql`insert into login_attempts (user_id, ip, succeeded) values (${user.id}, ${meta.ip}, true)`,
      );
      await run(
        tx,
        sql`update login_lockouts set failed_logins = 0, locked_until = null where user_id = ${user.id}`,
      );
      await writeAudit(tx, userActor(user.id), meta, {
        action: 'auth.login.succeeded',
        entityType: 'session',
        entityId: session.id,
      });
      return { ...tokens, user: await currentUserOf(tx, user.id) };
    });
  }

  async function refresh(refreshToken: string, meta: RequestMeta): Promise<TokenPair> {
    if (!/^hos_rt_[A-Za-z0-9_-]{43}$/.test(refreshToken)) throw unauthenticated();
    const limits = await settings.get();
    const outcome = await transaction(db, async (tx) => {
      const token = await maybeOne(
        tx,
        sql`select t.id, t.session_id, t.used_at, t.expires_at > now() as unexpired,
                   s.user_id, s.revoked_at is null as live,
                   s.idle_expires_at > now() and s.absolute_expires_at > now() as in_time,
                   u.status = 'active' as active
              from auth_tokens t
              join auth_sessions s on s.id = t.session_id
              join users u on u.id = s.user_id
             where t.token_hash = ${sha256Hex(refreshToken)} and t.kind = 'refresh'
             for update of t, s`,
        z.object({
          id: z.union([z.string(), z.number()]),
          session_id: z.uuid(),
          used_at: nullableInstant,
          unexpired: z.boolean(),
          user_id: z.uuid(),
          live: z.boolean(),
          in_time: z.boolean(),
          active: z.boolean(),
        }),
      );
      if (!token) return { kind: 'unknown' as const };
      if (token.used_at !== null) {
        // Reuse of a spent refresh token: someone else may hold a copy. End the whole family.
        if (token.live) {
          await run(
            tx,
            sql`update auth_sessions set revoked_at = now(), revoke_reason = 'refresh_reuse'
                 where id = ${token.session_id}`,
          );
        }
        await writeAudit(tx, userActor(token.user_id), meta, {
          action: 'auth.token.reuse_detected',
          entityType: 'session',
          entityId: token.session_id,
        });
        return { kind: 'reuse' as const };
      }
      if (!token.unexpired || !token.live || !token.in_time || !token.active) {
        return { kind: 'expired' as const };
      }
      await run(tx, sql`update auth_tokens set used_at = now() where id = ${token.id}`);
      await run(
        tx,
        sql`update auth_sessions
               set last_used_at = now(),
                   idle_expires_at = least(now() + make_interval(mins => ${limits.session_idle_minutes}),
                                           absolute_expires_at)
             where id = ${token.session_id}`,
      );
      return {
        kind: 'ok' as const,
        tokens: await issueTokens(tx, token.session_id, limits.access_token_minutes),
      };
    });
    if (outcome.kind !== 'ok') throw unauthenticated();
    return outcome.tokens;
  }

  async function signOut(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    await transaction(db, async (tx) => {
      await run(
        tx,
        sql`update auth_sessions set revoked_at = now(), revoke_reason = 'logout'
             where id = ${sessionId} and revoked_at is null`,
      );
      await writeAudit(tx, userActor(userId), meta, {
        action: 'auth.logout',
        entityType: 'session',
        entityId: sessionId,
      });
    });
  }

  async function signOutEverywhere(userId: string, meta: RequestMeta): Promise<number> {
    return transaction(db, async (tx) => {
      const count = await revokeSessions(tx, userId, 'logout_all');
      await writeAudit(tx, userActor(userId), meta, {
        action: 'auth.logout_all',
        entityType: 'user',
        entityId: userId,
        changes: { sessionsEnded: count },
      });
      return count;
    });
  }

  async function changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await one(db, sql`${USER_SELECT} where u.id = ${userId}`, userRow);
    if (!(await verifyPassword(currentPassword, user.password_hash))) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
        { path: 'currentPassword', message: 'Your current password is not right.' },
      ]);
    }
    if (newPassword === currentPassword || newPassword.toLowerCase().includes(user.username)) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
        {
          path: 'newPassword',
          message: 'Choose a new password that is not your username or old password.',
        },
      ]);
    }
    const hash = await hashPassword(newPassword);
    await transaction(db, async (tx) => {
      await run(
        tx,
        sql`update users set password_hash = ${hash}, must_change_password = false,
                   password_changed_at = now(), updated_by = ${userId}
             where id = ${userId}`,
      );
      await revokeSessions(tx, userId, 'password_changed', sessionId);
      await writeAudit(tx, userActor(userId), meta, {
        action: 'auth.password.changed',
        entityType: 'user',
        entityId: userId,
      });
    });
  }

  async function requestPasswordReset(identifier: string, meta: RequestMeta): Promise<void> {
    const limits = await settings.get();
    const normalized = identifier.trim().toLowerCase();
    const identifierHmac = hmacHex(resetCodePepper, `identifier:${normalized}`);

    const counts = await one(
      db,
      sql`select
            (select count(*)::int from password_reset_requests
              where identifier_hmac = ${identifierHmac} and requested_at > now() - interval '1 hour') as by_identifier,
            (select count(*)::int from password_reset_requests
              where ip = ${meta.ip} and requested_at > now() - interval '1 hour') as by_ip`,
      z.object({ by_identifier: z.number().int(), by_ip: z.number().int() }),
    );
    await run(
      db,
      sql`insert into password_reset_requests (identifier_hmac, ip) values (${identifierHmac}, ${meta.ip})`,
    );
    const user = await findUserByIdentifier(db, normalized);
    if (
      counts.by_identifier >= limits.password_reset_max_requests_per_account_hour ||
      counts.by_ip >= limits.password_reset_max_requests_per_ip_hour
    ) {
      await writeAudit(db, systemActor('anonymous'), meta, {
        action: 'auth.password_reset.rate_limited',
        entityType: 'user',
        entityId: user?.id ?? null,
      });
      return;
    }
    if (!user || user.status !== 'active' || user.email === null) return;

    const code = newResetCode();
    const email = user.email;
    await transaction(db, async (tx) => {
      await run(
        tx,
        sql`update password_reset_codes set invalidated_at = now()
             where user_id = ${user.id} and used_at is null and invalidated_at is null`,
      );
      await run(
        tx,
        sql`insert into password_reset_codes (user_id, code_hmac, expires_at)
            values (${user.id}, ${hmacHex(resetCodePepper, `${user.id}:${code}`)},
                    now() + make_interval(mins => ${limits.password_reset_code_minutes}))`,
      );
      await writeAudit(tx, systemActor('anonymous'), meta, {
        action: 'auth.password_reset.requested',
        entityType: 'user',
        entityId: user.id,
      });
    });
    // Sent after commit and not awaited by the response, so timing doesn't reveal the account.
    void mailer
      .send({
        to: email,
        subject: 'Your HospitalOS password reset code',
        text: `Your HospitalOS password reset code is ${code}.\n\nIt expires in ${limits.password_reset_code_minutes} minutes and can be used once. If you did not ask for it, ignore this email.`,
      })
      .catch((error: unknown) => {
        logger.error(
          { reason: error instanceof Error ? error.name : 'unknown' },
          'reset email not sent',
        );
      });
  }

  async function resetPassword(
    identifier: string,
    code: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<void> {
    const limits = await settings.get();
    const user = await findUserByIdentifier(db, identifier.trim().toLowerCase());
    if (!user || user.status !== 'active') {
      await dummyPasswordHash();
      throw invalidResetCode();
    }
    const hash = await hashPassword(newPassword);
    const outcome = await transaction(db, async (tx) => {
      const active = await maybeOne(
        tx,
        sql`select id, code_hmac, attempts from password_reset_codes
             where user_id = ${user.id} and used_at is null and invalidated_at is null
               and expires_at > now()
             order by created_at desc limit 1
             for update`,
        z.object({ id: z.uuid(), code_hmac: z.string(), attempts: z.number().int() }),
      );
      if (!active) return 'invalid' as const;
      if (!sameHex(active.code_hmac, hmacHex(resetCodePepper, `${user.id}:${code}`))) {
        const attempts = active.attempts + 1;
        const exhausted = attempts >= limits.password_reset_max_attempts_per_code;
        await run(
          tx,
          sql`update password_reset_codes
                 set attempts = ${attempts},
                     invalidated_at = case when ${exhausted} then now() else null end
               where id = ${active.id}`,
        );
        await writeAudit(tx, systemActor('anonymous'), meta, {
          action: exhausted
            ? 'auth.password_reset.code_invalidated'
            : 'auth.password_reset.code_failed',
          entityType: 'user',
          entityId: user.id,
        });
        return 'invalid' as const;
      }
      await run(tx, sql`update password_reset_codes set used_at = now() where id = ${active.id}`);
      await run(
        tx,
        sql`update users set password_hash = ${hash}, must_change_password = false,
                   password_changed_at = now()
             where id = ${user.id}`,
      );
      await revokeSessions(tx, user.id, 'password_reset');
      await run(
        tx,
        sql`update login_lockouts set failed_logins = 0, locked_until = null where user_id = ${user.id}`,
      );
      await writeAudit(tx, userActor(user.id), meta, {
        action: 'auth.password_reset.completed',
        entityType: 'user',
        entityId: user.id,
      });
      return 'done' as const;
    });
    if (outcome !== 'done') throw invalidResetCode();
  }

  return {
    signIn,
    refresh,
    signOut,
    signOutEverywhere,
    changePassword,
    requestPasswordReset,
    resetPassword,
    me: (userId: string) => currentUserOf(db, userId),
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
