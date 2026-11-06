import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { maybeOne, type Executor } from '../../db/sql';
import type { AuthContext } from '../../http/context';
import { AppError } from '../../lib/errors';

/**
 * Record-level access (architecture §3 rule 4). Routes check the permission; these functions check
 * the relationship to the record. A missing relationship answers 404, never revealing that the
 * record exists.
 */
export const notFound = () => new AppError(404, 'NOT_FOUND', 'Not found.');
export const TODAY = sql`(now() at time zone 'Asia/Kolkata')::date`;

/** The doctor profile of the signed-in user, if they are a doctor. */
export async function doctorIdOf(db: Executor, userId: string): Promise<string | undefined> {
  const row = await maybeOne(
    db,
    sql`select dp.id from doctor_profiles dp join users u on u.employee_id = dp.employee_id
         where u.id = ${userId} and dp.active`,
    z.object({ id: z.uuid() }),
  );
  return row?.id;
}

export async function requireDoctorId(db: Executor, auth: AuthContext): Promise<string> {
  const id = await doctorIdOf(db, auth.userId);
  if (!id) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
  return id;
}

/**
 * Can this user see the patient's clinical chart?
 * - Super Admin: always (every read is audited).
 * - Doctor: an appointment with the patient inside the care window (7 days before to 90 days
 *   after the visit, hospital settings).
 * - Nurse: the patient is checked in today in a session the nurse is assigned to.
 */
export async function chartAccessOf(
  db: Executor,
  auth: AuthContext,
  patientId: string,
): Promise<'super_admin' | 'doctor' | 'nurse' | null> {
  if (!auth.permissions.has('patient:read_clinical')) return null;
  if (auth.roles.includes('SA')) return 'super_admin';
  const doctorId = await doctorIdOf(db, auth.userId);
  if (doctorId) {
    const care = await maybeOne(
      db,
      sql`select 1 as ok from appointments a, hospital_settings s
           where s.id = 1 and a.patient_id = ${patientId} and a.doctor_id = ${doctorId}
             and a.status not in ('cancelled', 'rescheduled')
             and a.visit_date between ${TODAY} - s.care_window_after_days and ${TODAY} + s.care_window_before_days
           limit 1`,
      z.object({ ok: z.number() }),
    );
    if (care) return 'doctor';
  }
  if (auth.roles.includes('NUR') && (await nurseCanSeePatient(db, auth.userId, patientId)))
    return 'nurse';
  return null;
}

/** A checked-in patient today, in a doctor session this nurse is assigned to today. */
export async function nurseCanSeePatient(
  db: Executor,
  nurseUserId: string,
  patientId: string,
): Promise<boolean> {
  const row = await maybeOne(
    db,
    sql`select 1 as ok from appointments a
          join nurse_assignments na on na.doctor_id = a.doctor_id and na.session_date = a.visit_date
                                   and na.nurse_user_id = ${nurseUserId} and na.revoked_at is null
         where a.patient_id = ${patientId} and a.visit_date = ${TODAY}
           and a.status in ('checked_in', 'in_consultation')
           and (a.doctor_schedule_id is null or a.doctor_schedule_id = na.doctor_schedule_id)
         limit 1`,
    z.object({ ok: z.number() }),
  );
  return row !== undefined;
}

export async function nurseCanSeeAppointment(
  db: Executor,
  nurseUserId: string,
  appointmentId: string,
): Promise<boolean> {
  const row = await maybeOne(
    db,
    sql`select 1 as ok from appointments a
          join nurse_assignments na on na.doctor_id = a.doctor_id and na.session_date = a.visit_date
                                   and na.nurse_user_id = ${nurseUserId} and na.revoked_at is null
         where a.id = ${appointmentId} and a.visit_date = ${TODAY}
           and a.status in ('checked_in', 'in_consultation')
           and (a.doctor_schedule_id is null or a.doctor_schedule_id = na.doctor_schedule_id)`,
    z.object({ ok: z.number() }),
  );
  return row !== undefined;
}
