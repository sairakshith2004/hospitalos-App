import { randomBytes, randomUUID } from 'node:crypto';

import type { RoleCode } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '../../src/app';
import { hashPassword } from '../../src/auth/crypto';
import { createDatabase, many, one, run, type Db } from '../../src/db/sql';
import { captureMailer } from '../../src/mail/mailer';
import { authenticate } from '../../src/middleware/authenticate';
import { buildApi } from '../../src/modules/api';
import { seedAccessModel, seedBaseDepartments } from '../../src/seed/reference';
import { createSettingsProvider } from '../../src/settings';
import { captureLogger } from '../support/capture-logger';

import { appPool, ownerPool } from './support';

export const TEST_PEPPER = 'example-pepper-for-hospitalos-tests-only-0123456789';

/** A unique, valid suffix for usernames and numbers created by one test. */
export function unique(prefix = 't'): string {
  return `${prefix}${randomBytes(5).toString('hex')}`;
}

/** A distinct client IP per test, so rate limits of one test never affect another. */
export function testIp(): string {
  const b = randomBytes(3);
  return `10.${b[0] ?? 0}.${b[1] ?? 0}.${b[2] ?? 1}`;
}

export type TestApi = Readonly<{
  app: Express;
  db: Db;
  owner: Db;
  mailer: ReturnType<typeof captureMailer>;
  logLines: () => string[];
  close: () => Promise<void>;
}>;

/** The real API (every module) against hospitalos_test, as hos_app, with captured mail and logs. */
export async function startTestApi(): Promise<TestApi> {
  const appPg = appPool();
  const ownerPg = ownerPool();
  const db = createDatabase(appPg);
  const owner = createDatabase(ownerPg);
  await seedAccessModel(owner);
  await seedBaseDepartments(owner);
  const settings = createSettingsProvider(db, 0);
  const mailer = captureMailer();
  const { logger, lines } = captureLogger();
  const app = createApp({
    logger,
    checkReadiness: () => Promise.resolve(),
    rateLimit: { windowMs: 60_000, max: 100_000 },
    trustProxy: 'loopback',
    api: {
      modules: buildApi({ db, settings, mailer, resetCodePepper: TEST_PEPPER, logger }),
      authenticate: authenticate(db, settings),
    },
  });
  return {
    app,
    db,
    owner,
    mailer,
    logLines: lines,
    close: async () => {
      await Promise.all([appPg.end(), ownerPg.end()]);
    },
  };
}

export type TestUser = Readonly<{
  id: string;
  username: string;
  password: string;
  email: string | null;
}>;

let cachedHash: { password: string; hash: string } | undefined;

/** Creates an employee and user directly (as the owner) with the given roles. */
export async function createTestUser(
  owner: Db,
  options: Readonly<{
    roles?: readonly RoleCode[];
    mustChangePassword?: boolean;
    withEmail?: boolean;
    departmentCode?: string;
  }> = {},
): Promise<TestUser> {
  // One hash per test file run keeps the suite fast; every user still has a real argon2id hash.
  cachedHash ??= await (async () => {
    const password = `Pw-${randomBytes(9).toString('base64url')}`;
    return { password, hash: await hashPassword(password) };
  })();
  const username = unique('u');
  const email = options.withEmail === false ? null : `${username}@hospitalos.invalid`;
  const department = await one(
    owner,
    sql`select id from departments where code = ${options.departmentCode ?? 'ADMIN'}`,
    z.object({ id: z.uuid() }),
  );
  const employee = await one(
    owner,
    sql`insert into employees (employee_no, full_name, department_id, designation, email)
        values (${unique('E').toUpperCase()}, ${`Test ${username}`}, ${department.id}, 'Tester', ${email})
        returning id`,
    z.object({ id: z.uuid() }),
  );
  const user = await one(
    owner,
    sql`insert into users (employee_id, username, password_hash, must_change_password)
        values (${employee.id}, ${username}, ${cachedHash.hash}, ${options.mustChangePassword ?? false})
        returning id`,
    z.object({ id: z.uuid() }),
  );
  for (const role of options.roles ?? []) {
    await run(
      owner,
      sql`insert into user_roles (user_id, role_id) select ${user.id}, id from roles where code = ${role}`,
    );
  }
  return { id: user.id, username, password: cachedHash.password, email };
}

export type Session = Readonly<{ accessToken: string; refreshToken: string; ip: string }>;

/** Signs in through the real endpoint. */
export async function signIn(app: Express, user: TestUser, ip = testIp()): Promise<Session> {
  const res = await request(app)
    .post('/api/v1/auth/sessions')
    .set('X-Forwarded-For', ip)
    .send({ username: user.username, password: user.password, deviceLabel: 'Test device' });
  if (res.status !== 201)
    throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  const body = z.object({ accessToken: z.string(), refreshToken: z.string() }).parse(res.body);
  return { ...body, ip };
}

/** Creates a user with the roles and signs them in. */
export async function signedIn(
  api: TestApi,
  roles: readonly RoleCode[],
): Promise<Session & { user: TestUser }> {
  const user = await createTestUser(api.owner, { roles });
  return { ...(await signIn(api.app, user)), user };
}

export const bearer = (session: Session) => ({ Authorization: `Bearer ${session.accessToken}` });

export type TestDoctor = Readonly<{ user: TestUser; doctorId: string; session: Session }>;

/** A doctor with a login, a profile and all-day hours on every weekday (so tests never depend on the clock). */
export async function createTestDoctor(api: TestApi, feePaise = 50_000): Promise<TestDoctor> {
  const user = await createTestUser(api.owner, { roles: ['DOC'], departmentCode: 'GENMED' });
  const profile = await one(
    api.owner,
    sql`insert into doctor_profiles (employee_id, department_id, specialty, registration_no, default_slot_minutes, consultation_fee_paise)
        select u.employee_id, e.department_id, 'General Medicine', ${`TREG-${unique()}`}, 15, ${feePaise}
          from users u join employees e on e.id = u.employee_id where u.id = ${user.id}
        returning id`,
    z.object({ id: z.uuid() }),
  );
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await run(
      api.owner,
      sql`insert into doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes, valid_from)
          values (${profile.id}, ${weekday}, '00:00'::time, '23:45'::time, 15, date '2026-01-01')`,
    );
  }
  return { user, doctorId: profile.id, session: await signIn(api.app, user) };
}

/** Registers a synthetic patient through the API (confirming they're not a duplicate). */
export async function registerPatient(
  api: TestApi,
  reception: Session,
): Promise<{ id: string; mrn: string }> {
  const res = await request(api.app)
    .post('/api/v1/patients')
    .set(bearer(reception))
    .send({
      firstName: 'Test',
      lastName: unique('Patient'),
      dob: '1990-04-12',
      sex: 'female',
      phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      confirmNotDuplicate: true,
    });
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return z.object({ id: z.uuid(), mrn: z.string() }).parse(res.body);
}

export const idem = () => ({ 'Idempotency-Key': randomUUID() });

/**
 * Tomorrow's first free slot for the doctor whose same time today is also free, so the appointment
 * can later be moved to today (see moveToToday) without overlapping another one.
 */
export async function firstSlotTomorrow(
  api: TestApi,
  session: Session,
  doctorId: string,
): Promise<string> {
  const day = await one(
    api.owner,
    sql`select ((now() at time zone 'Asia/Kolkata')::date + 1)::text as d`,
    z.object({ d: z.string() }),
  );
  const res = await request(api.app)
    .get(`/api/v1/doctors/${doctorId}/availability?date=${day.d}`)
    .set(bearer(session));
  const slots = z.object({ slots: z.array(z.object({ start: z.string() })) }).parse(res.body).slots;
  const takenToday = new Set(
    (
      await many(
        api.owner,
        sql`select slot_start from appointments where doctor_id = ${doctorId} and slot_start is not null
               and status in ('booked', 'checked_in', 'in_consultation')`,
        z.object({ slot_start: z.union([z.string(), z.date()]) }),
      )
    ).map((r) => new Date(r.slot_start).getTime()),
  );
  const slot = slots.find((s) => !takenToday.has(new Date(s.start).getTime() - 86_400_000));
  if (!slot) throw new Error('no usable slot tomorrow');
  return slot.start;
}

/** Simulates the visit day arriving: moves a booked appointment from tomorrow to today. */
export async function moveToToday(api: TestApi, appointmentId: string): Promise<void> {
  await run(
    api.owner,
    sql`update appointments a set slot_start = a.slot_start - interval '1 day', slot_end = a.slot_end - interval '1 day',
               visit_date = a.visit_date - 1,
               doctor_schedule_id = (select s.id from doctor_schedules s where s.doctor_id = a.doctor_id
                                       and s.weekday = extract(isodow from a.visit_date - 1) limit 1)
         where a.id = ${appointmentId}`,
  );
}
