import {
  PERMISSIONS,
  ROLE_CODES,
  ROLE_PERMISSIONS,
  errorEnvelopeSchema,
  signInResponseSchema,
} from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { many, one, run } from '../../src/db/sql';
import { seedDemoAccounts } from '../../src/seed/demo-accounts';
import { bootstrapSuperAdmin, operatorResetPassword } from '../../src/auth/operator';

import {
  bearer,
  createTestUser,
  signIn,
  signedIn,
  startTestApi,
  testIp,
  unique,
  type TestApi,
} from './api-support';

let api: TestApi;

beforeAll(async () => {
  api = await startTestApi();
});

afterAll(async () => {
  await api.close();
});

const codeOf = (body: unknown) => errorEnvelopeSchema.parse(body).error.code;

/** The database's own message for a failed query (Drizzle wraps it as `cause`). */
async function causeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    return cause instanceof Error ? cause.message : String(error);
  }
  return 'did not fail';
}

async function auditActions(entityId: string): Promise<string[]> {
  const rows = await many(
    api.owner,
    sql`select action from audit_logs where entity_id = ${entityId} order by id`,
    z.object({ action: z.string() }),
  );
  return rows.map((r) => r.action);
}

describe('access model seed', () => {
  it('stores exactly the 11 roles, 88 permissions and the reference grants', async () => {
    const roles = await many(
      api.db,
      sql`select code from roles order by code`,
      z.object({ code: z.string() }),
    );
    expect(roles.map((r) => r.code).sort()).toEqual([...ROLE_CODES].sort());
    const permissions = await many(
      api.db,
      sql`select code from permissions`,
      z.object({ code: z.string() }),
    );
    expect(permissions).toHaveLength(88);
    expect(new Set(permissions.map((p) => p.code))).toEqual(new Set(PERMISSIONS));
    for (const role of ROLE_CODES) {
      const grants = await many(
        api.db,
        sql`select p.code from role_permissions rp join roles r on r.id = rp.role_id
              join permissions p on p.id = rp.permission_id where r.code = ${role}`,
        z.object({ code: z.string() }),
      );
      expect(new Set(grants.map((g) => g.code)), role).toEqual(new Set(ROLE_PERMISSIONS[role]));
    }
  });

  it('cannot be changed by the application user', async () => {
    await expect(run(api.db, sql`insert into permissions (code) values ('x:y')`)).rejects.toThrow();
    await expect(run(api.db, sql`delete from role_permissions`)).rejects.toThrow();
    await expect(run(api.db, sql`update roles set name = 'x'`)).rejects.toThrow();
  });
});

describe('sign-in', () => {
  it('returns opaque tokens and the user with fresh permissions; only hashes are stored', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const res = await request(api.app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', testIp())
      .send({
        username: user.username.toUpperCase(),
        password: user.password,
        deviceLabel: 'Pixel 8',
      });
    expect(res.status).toBe(201);
    const body = signInResponseSchema.parse(res.body);
    expect(body.user.roles).toEqual(['REC']);
    expect(new Set(body.user.permissions)).toEqual(new Set(ROLE_PERMISSIONS.REC));
    const minutes = (Date.parse(body.accessExpiresAt) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    const leaked = await one(
      api.owner,
      sql`select count(*)::int as n from auth_tokens where token_hash in (${body.accessToken}, ${body.refreshToken})`,
      z.object({ n: z.number() }),
    );
    expect(leaked.n).toBe(0);
    const me = await request(api.app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: user.username, roles: ['REC'] });
  });

  it('answers the same for a wrong password and an unknown username', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const ip = testIp();
    const wrong = await request(api.app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', ip)
      .send({ username: user.username, password: 'not-the-password', deviceLabel: 'x' });
    const unknown = await request(api.app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', ip)
      .send({ username: unique('nobody'), password: 'not-the-password', deviceLabel: 'x' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(codeOf(wrong.body)).toBe('INVALID_CREDENTIALS');
    expect(errorEnvelopeSchema.parse(unknown.body).error.message).toBe(
      errorEnvelopeSchema.parse(wrong.body).error.message,
    );
    expect(await auditActions(user.id)).toContain('auth.login.failed');
  });

  it('locks the account for that IP only after 5 wrong passwords', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const ip = testIp();
    for (let i = 0; i < 5; i += 1) {
      await request(api.app)
        .post('/api/v1/auth/sessions')
        .set('X-Forwarded-For', ip)
        .send({ username: user.username, password: 'wrong-password', deviceLabel: 'x' });
    }
    const locked = await request(api.app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', ip)
      .send({ username: user.username, password: user.password, deviceLabel: 'x' });
    expect(locked.status).toBe(401);
    expect(await auditActions(user.id)).toContain('auth.login.locked');
    // The real user elsewhere is not locked out by a stranger.
    await expect(signIn(api.app, user, testIp())).resolves.toBeTruthy();
  });

  it('limits failed sign-ins per IP (10 per 15 minutes)', async () => {
    const ip = testIp();
    for (let i = 0; i < 10; i += 1) {
      await request(api.app)
        .post('/api/v1/auth/sessions')
        .set('X-Forwarded-For', ip)
        .send({ username: unique('nobody'), password: 'wrong-password', deviceLabel: 'x' });
    }
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const limited = await request(api.app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', ip)
      .send({ username: user.username, password: user.password, deviceLabel: 'x' });
    expect(limited.status).toBe(429);
    expect(codeOf(limited.body)).toBe('RATE_LIMITED');
  });

  it('refuses a disabled account with the generic answer', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    await run(api.owner, sql`update users set status = 'disabled' where id = ${user.id}`);
    const res = await request(api.app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', testIp())
      .send({ username: user.username, password: user.password, deviceLabel: 'x' });
    expect(res.status).toBe(401);
    expect(codeOf(res.body)).toBe('INVALID_CREDENTIALS');
  });

  it('rejects unknown fields instead of trusting client-supplied identity', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const res = await request(api.app)
      .post('/api/v1/auth/sessions')
      .set('X-Forwarded-For', testIp())
      .send({ username: user.username, password: user.password, deviceLabel: 'x', roles: ['SA'] });
    expect(res.status).toBe(422);
  });
});

describe('sessions and tokens', () => {
  it('denies protected routes without a valid bearer token', async () => {
    for (const header of [
      undefined,
      'Bearer nope',
      'Basic abc',
      `Bearer hos_at_${'A'.repeat(43)}`,
    ]) {
      const req = request(api.app).get('/api/v1/auth/me');
      const res = await (header ? req.set('Authorization', header) : req);
      expect(res.status).toBe(401);
      expect(codeOf(res.body)).toBe('UNAUTHENTICATED');
    }
  });

  it('rotates refresh tokens and ends the whole family when a spent one is reused', async () => {
    const s = await signedIn(api, ['DOC']);
    const first = await request(api.app)
      .post('/api/v1/auth/token')
      .send({ refreshToken: s.refreshToken });
    expect(first.status).toBe(200);
    const rotated = z
      .object({ accessToken: z.string(), refreshToken: z.string() })
      .parse(first.body);
    expect(rotated.refreshToken).not.toBe(s.refreshToken);

    const reuse = await request(api.app)
      .post('/api/v1/auth/token')
      .send({ refreshToken: s.refreshToken });
    expect(reuse.status).toBe(401);
    // Every token of the family stops working at once.
    expect(
      (
        await request(api.app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${rotated.accessToken}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(api.app)
          .post('/api/v1/auth/token')
          .send({ refreshToken: rotated.refreshToken })
      ).status,
    ).toBe(401);
    const reuseAudit = await one(
      api.owner,
      sql`select count(*)::int as n from audit_logs where action = 'auth.token.reuse_detected' and actor_user_id = ${s.user.id}`,
      z.object({ n: z.number() }),
    );
    expect(reuseAudit.n).toBe(1);
  });

  it('signs out: the access and refresh tokens stop working', async () => {
    const s = await signedIn(api, ['DOC']);
    expect(
      (await request(api.app).delete('/api/v1/auth/sessions/current').set(bearer(s))).status,
    ).toBe(204);
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(s))).status).toBe(401);
    expect(
      (await request(api.app).post('/api/v1/auth/token').send({ refreshToken: s.refreshToken }))
        .status,
    ).toBe(401);
  });

  it('signs out everywhere', async () => {
    const user = await createTestUser(api.owner, { roles: ['DOC'] });
    const a = await signIn(api.app, user);
    const b = await signIn(api.app, user);
    const res = await request(api.app).post('/api/v1/auth/sessions/logout-all').set(bearer(a));
    expect(res.body).toEqual({ sessionsEnded: 2 });
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(b))).status).toBe(401);
  });

  it('enforces the idle and absolute session limits', async () => {
    const idle = await signedIn(api, ['DOC']);
    await run(
      api.owner,
      sql`update auth_sessions set idle_expires_at = now() - interval '1 second' where user_id = ${idle.user.id}`,
    );
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(idle))).status).toBe(401);
    expect(
      (await request(api.app).post('/api/v1/auth/token').send({ refreshToken: idle.refreshToken }))
        .status,
    ).toBe(401);

    const absolute = await signedIn(api, ['DOC']);
    await run(
      api.owner,
      sql`update auth_sessions set idle_expires_at = now() - interval '2 seconds', absolute_expires_at = now() - interval '1 second'
           where user_id = ${absolute.user.id}`,
    );
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(absolute))).status).toBe(401);
  });

  it('caps sessions at 30 minutes idle and 12 hours absolute', async () => {
    const s = await signedIn(api, ['DOC']);
    const row = await one(
      api.owner,
      sql`select extract(epoch from idle_expires_at - created_at)::int as idle,
                 extract(epoch from absolute_expires_at - created_at)::int as absolute
            from auth_sessions where user_id = ${s.user.id}`,
      z.object({ idle: z.number(), absolute: z.number() }),
    );
    expect(row.idle).toBeLessThanOrEqual(30 * 60 + 1);
    expect(row.absolute).toBe(12 * 60 * 60);
  });

  it('ends every session when the account is disabled, even with a live token', async () => {
    const s = await signedIn(api, ['DOC']);
    await run(api.owner, sql`update users set status = 'disabled' where id = ${s.user.id}`);
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(s))).status).toBe(401);
  });
});

describe('passwords', () => {
  it('forces a new password before anything else is allowed', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'], mustChangePassword: true });
    const s = await signIn(api.app, user);
    const other = await signIn(api.app, user);
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(s))).status).toBe(200);
    const blocked = await request(api.app).get('/api/v1/admin/staff').set(bearer(s));
    expect(blocked.status).toBe(403);
    expect(codeOf(blocked.body)).toBe('PASSWORD_CHANGE_REQUIRED');

    const newPassword = `New-${unique()}-password`;
    const changed = await request(api.app)
      .post('/api/v1/auth/password')
      .set(bearer(s))
      .send({ currentPassword: user.password, newPassword });
    expect(changed.status).toBe(204);
    const me = await request(api.app).get('/api/v1/auth/me').set(bearer(s));
    expect(me.body).toMatchObject({ mustChangePassword: false });
    // Every other session ends; the current one stays.
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(other))).status).toBe(401);
    await expect(signIn(api.app, { ...user, password: newPassword })).resolves.toBeTruthy();
  });

  it('refuses a wrong current password, a weak password and the username', async () => {
    const s = await signedIn(api, ['REC']);
    const wrong = await request(api.app)
      .post('/api/v1/auth/password')
      .set(bearer(s))
      .send({ currentPassword: 'wrong', newPassword: 'a-long-new-password' });
    expect(wrong.status).toBe(422);
    const short = await request(api.app)
      .post('/api/v1/auth/password')
      .set(bearer(s))
      .send({ currentPassword: s.user.password, newPassword: 'short' });
    expect(short.status).toBe(422);
    const name = await request(api.app)
      .post('/api/v1/auth/password')
      .set(bearer(s))
      .send({ currentPassword: s.user.password, newPassword: `${s.user.username}-123456` });
    expect(name.status).toBe(422);
  });
});

describe('forgot and reset password', () => {
  const codeIn = (text: string) => /\b(\d{8})\b/.exec(text)?.[1];

  it('answers 202 the same way for known and unknown accounts', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const before = api.mailer.sent.length;
    const known = await request(api.app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', testIp())
      .send({ identifier: user.username });
    const unknown = await request(api.app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', testIp())
      .send({ identifier: unique('nobody') });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.mailer.sent.length).toBe(before + 1);
    const mail = api.mailer.sent.at(-1);
    expect(mail?.to).toBe(user.email);
    expect(mail?.subject).not.toContain(user.username);
    const code = codeIn(mail?.text ?? '');
    expect(code).toMatch(/^\d{8}$/);
    const stored = await one(
      api.owner,
      sql`select count(*)::int as n from password_reset_codes where user_id = ${user.id} and code_hmac <> ${code ?? ''}`,
      z.object({ n: z.number() }),
    );
    expect(stored.n).toBe(1); // a keyed hash, never the code itself
  });

  it('sends at most 3 codes per account per hour', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const before = api.mailer.sent.filter((m) => m.to === user.email).length;
    for (let i = 0; i < 4; i += 1) {
      const res = await request(api.app)
        .post('/api/v1/auth/password/forgot')
        .set('X-Forwarded-For', testIp())
        .send({ identifier: user.username });
      expect(res.status).toBe(202);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.mailer.sent.filter((m) => m.to === user.email).length - before).toBe(3);
  });

  it('sends at most 10 codes per IP per hour', async () => {
    const ip = testIp();
    const users = await Promise.all(
      Array.from({ length: 11 }, () => createTestUser(api.owner, { roles: ['REC'] })),
    );
    const before = api.mailer.sent.length;
    for (const user of users) {
      await request(api.app)
        .post('/api/v1/auth/password/forgot')
        .set('X-Forwarded-For', ip)
        .send({ identifier: user.username });
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.mailer.sent.length - before).toBe(10);
  });

  it('resets with the right code, ends every session and refuses the code afterwards', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const session = await signIn(api.app, user);
    await request(api.app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', testIp())
      .send({ identifier: user.email });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const code =
      codeIn(api.mailer.sent.filter((m) => m.to === user.email).at(-1)?.text ?? '') ?? '';
    const newPassword = `Reset-${unique()}-password`;
    const reset = await request(api.app)
      .post('/api/v1/auth/password/reset')
      .send({ identifier: user.username, code, newPassword });
    expect(reset.status).toBe(204);
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(session))).status).toBe(401);
    await expect(signIn(api.app, { ...user, password: newPassword })).resolves.toBeTruthy();
    const again = await request(api.app)
      .post('/api/v1/auth/password/reset')
      .send({ identifier: user.username, code, newPassword: `${newPassword}-2` });
    expect(again.status).toBe(400);
    expect(codeOf(again.body)).toBe('INVALID_RESET_CODE');
  });

  it('invalidates a code after 5 wrong attempts', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    await request(api.app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', testIp())
      .send({ identifier: user.username });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const code =
      codeIn(api.mailer.sent.filter((m) => m.to === user.email).at(-1)?.text ?? '') ?? '';
    const wrongCode = code === '00000000' ? '11111111' : '00000000';
    for (let i = 0; i < 5; i += 1) {
      const res = await request(api.app)
        .post('/api/v1/auth/password/reset')
        .send({ identifier: user.username, code: wrongCode, newPassword: 'a-long-new-password' });
      expect(res.status).toBe(400);
    }
    const right = await request(api.app)
      .post('/api/v1/auth/password/reset')
      .send({ identifier: user.username, code, newPassword: 'a-long-new-password' });
    expect(right.status).toBe(400);
    expect(await auditActions(user.id)).toContain('auth.password_reset.code_invalidated');
  });

  it('refuses an expired code', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    await request(api.app)
      .post('/api/v1/auth/password/forgot')
      .set('X-Forwarded-For', testIp())
      .send({ identifier: user.username });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const code =
      codeIn(api.mailer.sent.filter((m) => m.to === user.email).at(-1)?.text ?? '') ?? '';
    await run(
      api.owner,
      sql`update password_reset_codes set created_at = now() - interval '20 minutes', expires_at = now() - interval '1 second'
           where user_id = ${user.id}`,
    );
    const res = await request(api.app)
      .post('/api/v1/auth/password/reset')
      .send({ identifier: user.username, code, newPassword: 'a-long-new-password' });
    expect(res.status).toBe(400);
  });

  it('never writes passwords, tokens or codes to the logs', async () => {
    const s = await signedIn(api, ['REC']);
    const lines = api.logLines().join('\n');
    expect(lines).not.toContain(s.accessToken);
    expect(lines).not.toContain(s.refreshToken);
    expect(lines).not.toContain(s.user.password);
    for (const mail of api.mailer.sent) {
      const code = codeIn(mail.text);
      if (code) expect(lines).not.toContain(code);
    }
  });
});

describe('staff administration', () => {
  const newStaff = () => ({
    fullName: 'Asha Verma',
    employeeNo: unique('EMP').toUpperCase(),
    departmentCode: 'ADMIN',
    designation: 'Receptionist',
    username: unique('staff'),
    temporaryPassword: 'Temporary-password-123',
  });

  it('lets HR create a login with a forced password change, and nobody else without user:create', async () => {
    const hr = await signedIn(api, ['HR']);
    const body = newStaff();
    const created = await request(api.app).post('/api/v1/admin/staff').set(bearer(hr)).send(body);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      username: body.username,
      roles: [],
      mustChangePassword: true,
      status: 'active',
    });
    expect(await auditActions(z.object({ id: z.string() }).parse(created.body).id)).toEqual([
      'user.created',
    ]);

    for (const role of ['REC', 'DOC', 'ADM', 'FIN'] as const) {
      const other = await signedIn(api, [role]);
      const res = await request(api.app)
        .post('/api/v1/admin/staff')
        .set(bearer(other))
        .send(newStaff());
      expect(res.status, role).toBe(403);
    }
    const duplicate = await request(api.app)
      .post('/api/v1/admin/staff')
      .set(bearer(hr))
      .send({ ...newStaff(), username: body.username });
    expect(duplicate.status).toBe(409);
  });

  it('lets only a Super Admin grant and revoke roles, never on their own account', async () => {
    const sa = await signedIn(api, ['SA']);
    const target = await createTestUser(api.owner);
    const granted = await request(api.app)
      .post(`/api/v1/admin/users/${target.id}/roles/grant`)
      .set(bearer(sa))
      .send({ role: 'DOC', reason: 'New doctor joined' });
    expect(granted.status).toBe(200);
    expect(granted.body).toMatchObject({ roles: ['DOC'] });

    const hr = await signedIn(api, ['HR']);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/admin/users/${target.id}/roles/grant`)
          .set(bearer(hr))
          .send({ role: 'SA', reason: 'escalation' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/admin/users/${sa.user.id}/roles/grant`)
          .set(bearer(sa))
          .send({ role: 'DOC', reason: 'self grant' })
      ).status,
    ).toBe(422);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/admin/users/${target.id}/roles/grant`)
          .set(bearer(sa))
          .send({ role: 'DOC' })
      ).status,
    ).toBe(422);

    const session = await signIn(api.app, target);
    const revoked = await request(api.app)
      .post(`/api/v1/admin/users/${target.id}/roles/revoke`)
      .set(bearer(sa))
      .send({ role: 'DOC', reason: 'Left the department' });
    expect(revoked.status).toBe(200);
    expect(revoked.body).toMatchObject({ roles: [] });
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(session))).status).toBe(401);
    expect(await auditActions(target.id)).toEqual(['user_role.granted', 'user_role.revoked']);
  });

  it('lets an administrator disable and re-enable accounts, but not a Super Admin account', async () => {
    const adm = await signedIn(api, ['ADM']);
    const target = await createTestUser(api.owner, { roles: ['REC'] });
    const session = await signIn(api.app, target);
    const disabled = await request(api.app)
      .post(`/api/v1/admin/users/${target.id}/status`)
      .set(bearer(adm))
      .send({ status: 'disabled', reason: 'Left the hospital' });
    expect(disabled.status).toBe(200);
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(session))).status).toBe(401);
    const enabled = await request(api.app)
      .post(`/api/v1/admin/users/${target.id}/status`)
      .set(bearer(adm))
      .send({ status: 'active', reason: 'Returned' });
    expect(enabled.body).toMatchObject({ status: 'active' });

    const sa = await createTestUser(api.owner, { roles: ['SA'] });
    expect(
      (
        await request(api.app)
          .post(`/api/v1/admin/users/${sa.id}/status`)
          .set(bearer(adm))
          .send({ status: 'disabled', reason: 'attempt' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(api.app)
          .post(`/api/v1/admin/users/${adm.user.id}/status`)
          .set(bearer(adm))
          .send({ status: 'disabled', reason: 'self' })
      ).status,
    ).toBe(422);
  });

  it('never lets the last active Super Admin lose access (database backstop)', async () => {
    // Direct database attempt, bypassing the service: the deferred trigger refuses at commit when
    // no other active SA would remain. Here other SAs exist, so remove them all in one statement.
    await expect(
      causeOf(
        run(
          api.owner,
          sql`delete from user_roles where role_id = (select id from roles where code = 'SA')`,
        ),
      ),
    ).resolves.toMatch(/last active Super Admin/);
  });

  it('lists roles and permissions for staff administrators only', async () => {
    const sa = await signedIn(api, ['SA']);
    const roles = await request(api.app).get('/api/v1/admin/roles').set(bearer(sa));
    expect(roles.status).toBe(200);
    expect(z.object({ items: z.array(z.unknown()) }).parse(roles.body).items).toHaveLength(11);
    const permissions = await request(api.app).get('/api/v1/admin/permissions').set(bearer(sa));
    expect(z.object({ items: z.array(z.string()) }).parse(permissions.body).items).toHaveLength(88);
    const doc = await signedIn(api, ['DOC']);
    expect((await request(api.app).get('/api/v1/admin/roles').set(bearer(doc))).status).toBe(403);
    expect((await request(api.app).get('/api/v1/admin/audit/auth').set(bearer(doc))).status).toBe(
      403,
    );
    expect((await request(api.app).get('/api/v1/admin/audit/auth').set(bearer(sa))).status).toBe(
      200,
    );
  });
});

describe('operator commands and demo accounts', () => {
  it('refuses a second bootstrap while an active Super Admin exists', async () => {
    await createTestUser(api.owner, { roles: ['SA'] });
    await expect(
      bootstrapSuperAdmin(
        api.owner,
        {
          username: unique('boot'),
          fullName: 'Boot',
          password: 'a-long-bootstrap-password',
          mustChangePassword: false,
        },
        'tester',
      ),
    ).rejects.toThrow(/already exists/);
  });

  it('resets a password as the operator, ending every session', async () => {
    const user = await createTestUser(api.owner, { roles: ['REC'] });
    const session = await signIn(api.app, user);
    await operatorResetPassword(
      api.owner,
      user.username,
      'operator-set-password-1',
      true,
      'tester',
    );
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(session))).status).toBe(401);
    expect(await auditActions(user.id)).toContain('user.password_reset');
  });

  it('refuses demo accounts outside development and test', async () => {
    await expect(seedDemoAccounts(api.owner, 'production')).rejects.toThrow(
      /only in development and test/,
    );
  });
});

describe('app version check', () => {
  it('answers 426 to builds below the configured minimum, and nothing changes without one', async () => {
    const s = await signedIn(api, ['REC']);
    expect((await request(api.app).get('/api/v1/auth/me').set(bearer(s))).status).toBe(200);
    await run(api.owner, sql`update hospital_settings set app_min_version_android = '1.2.0'`);
    try {
      const old = await request(api.app)
        .get('/api/v1/auth/me')
        .set(bearer(s))
        .set('X-App-Platform', 'android')
        .set('X-App-Version', '1.1.9');
      expect(old.status).toBe(426);
      expect(codeOf(old.body)).toBe('APP_UPDATE_REQUIRED');
      const missing = await request(api.app).get('/api/v1/auth/me').set(bearer(s));
      expect(missing.status).toBe(426);
      const current = await request(api.app)
        .get('/api/v1/auth/me')
        .set(bearer(s))
        .set('X-App-Platform', 'android')
        .set('X-App-Version', '1.2.0');
      expect(current.status).toBe(200);
      const policy = await request(api.app).get('/api/v1/app/version-policy');
      expect(policy.body).toMatchObject({ android: { minimum: '1.2.0' } });
    } finally {
      await run(api.owner, sql`update hospital_settings set app_min_version_android = null`);
    }
  });
});

describe('audit log', () => {
  it('is append-only even for the database owner', async () => {
    await expect(
      causeOf(
        run(
          api.owner,
          sql`update audit_logs set action = 'x.y' where id = (select min(id) from audit_logs)`,
        ),
      ),
    ).resolves.toMatch(/append-only/);
    await expect(
      causeOf(
        run(api.owner, sql`delete from audit_logs where id = (select min(id) from audit_logs)`),
      ),
    ).resolves.toMatch(/append-only/);
    await expect(run(api.db, sql`update audit_logs set action = 'x.y'`)).rejects.toThrow();
  });
});
