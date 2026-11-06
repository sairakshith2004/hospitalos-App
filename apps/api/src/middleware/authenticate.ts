import type { Permission } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from 'express';
import { z } from 'zod';

import { loadGrants } from '../auth/access';
import { sha256Hex } from '../auth/crypto';
import { maybeOne, run, type Db } from '../db/sql';
import { AppError } from '../lib/errors';
import type { SettingsProvider } from '../settings';

const BEARER = /^Bearer (hos_at_[A-Za-z0-9_-]{43})$/;

const sessionRow = z.object({
  session_id: z.uuid(),
  user_id: z.uuid(),
  must_change_password: z.boolean(),
});

/** Paths a user who must change their password may still use. */
const ALLOWED_DURING_FORCED_CHANGE = new Set([
  'GET /api/v1/auth/me',
  'POST /api/v1/auth/password',
  'DELETE /api/v1/auth/sessions/current',
]);

const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');

/**
 * Every protected request (architecture §5.2): the bearer token's hash matches an unexpired access
 * token whose session is unrevoked and inside both limits, and the user is active. Roles and
 * permissions are loaded fresh. The idle expiry slides forward. Any failure is a bare 401.
 */
export function authenticate(db: Db, settings: SettingsProvider): RequestHandler {
  return async (req, _res, next) => {
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? BEARER.exec(header) : null;
    if (!match?.[1]) throw unauthenticated();

    const row = await maybeOne(
      db,
      sql`select s.id as session_id, s.user_id, u.must_change_password
            from auth_tokens t
            join auth_sessions s on s.id = t.session_id
            join users u on u.id = s.user_id
           where t.token_hash = ${sha256Hex(match[1])}
             and t.kind = 'access' and t.expires_at > now()
             and s.revoked_at is null
             and s.idle_expires_at > now() and s.absolute_expires_at > now()
             and u.status = 'active'`,
      sessionRow,
    );
    if (!row) throw unauthenticated();

    const { session_idle_minutes: idle } = await settings.get();
    await run(
      db,
      sql`update auth_sessions
             set last_used_at = now(),
                 idle_expires_at = least(now() + make_interval(mins => ${idle}), absolute_expires_at)
           where id = ${row.session_id}`,
    );

    const grants = await loadGrants(db, row.user_id);
    req.auth = {
      userId: row.user_id,
      sessionId: row.session_id,
      roles: grants.roles,
      permissions: new Set(grants.permissions),
      mustChangePassword: row.must_change_password,
    };

    const path = req.originalUrl.split('?')[0] ?? '';
    if (row.must_change_password && !ALLOWED_DURING_FORCED_CHANGE.has(`${req.method} ${path}`)) {
      throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Choose a new password to continue.');
    }
    next();
  };
}

const forbidden = () => new AppError(403, 'FORBIDDEN', 'You do not have access to this.');

/** Deny unless the caller holds the permission. Record-level checks follow in the service. */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth?.permissions.has(permission)) throw forbidden();
    next();
  };
}

/** Deny unless the caller holds at least one of the permissions. */
export function requireAnyPermission(permissions: readonly Permission[]): RequestHandler {
  return (req, _res, next) => {
    const held = req.auth?.permissions;
    if (!held || !permissions.some((permission) => held.has(permission))) throw forbidden();
    next();
  };
}
