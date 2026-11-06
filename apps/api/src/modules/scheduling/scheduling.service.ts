import type { Appointment } from '@hospitalos/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
import {
  dateText,
  many,
  maybeOne,
  nullableTimestamptz,
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
import { addCharge, cancelCharge } from '../billing/billing.core';
import { doctorIdOf, notFound, TODAY } from '../shared/access';
import { idempotent } from '../shared/idempotency';

const unprocessable = (message: string) => new AppError(422, 'INVALID_STATE', message);
const slotTaken = () =>
  new AppError(409, 'SLOT_UNAVAILABLE', 'That time is no longer free. Choose another slot.');

const appointmentRow = z.object({
  id: z.uuid(),
  appointment_no: z.string(),
  kind: z.enum(['scheduled', 'walk_in', 'follow_up']),
  status: z.enum([
    'booked',
    'checked_in',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show',
    'rescheduled',
  ]),
  did_not_arrive: z.boolean(),
  visit_date: dateText,
  slot_start: nullableTimestamptz,
  slot_end: nullableTimestamptz,
  token_no: z.number().nullable(),
  patient_id: z.uuid(),
  mrn: z.string(),
  patient_name: z.string(),
  doctor_id: z.uuid(),
  doctor_name: z.string(),
  department_name: z.string(),
  checked_in_at: nullableTimestamptz,
  cancel_reason: z.string().nullable(),
  version: z.number(),
});

const APPOINTMENT_SELECT = sql`select a.id, a.appointment_no, a.kind, a.status,
    (a.status = 'booked' and a.visit_date < (now() at time zone 'Asia/Kolkata')::date) as did_not_arrive,
    a.visit_date::text as visit_date, a.slot_start, a.slot_end, a.token_no,
    p.id as patient_id, p.mrn, p.first_name || ' ' || p.last_name as patient_name,
    dp.id as doctor_id, e.full_name as doctor_name, d.name as department_name,
    a.checked_in_at, a.cancel_reason, a.version
  from appointments a
  join patients p on p.id = a.patient_id
  join doctor_profiles dp on dp.id = a.doctor_id
  join employees e on e.id = dp.employee_id
  join departments d on d.id = a.department_id`;

function toAppointment(r: z.infer<typeof appointmentRow>): Appointment {
  return {
    id: r.id,
    appointmentNo: r.appointment_no,
    kind: r.kind,
    status: r.status,
    didNotArrive: r.did_not_arrive,
    visitDate: r.visit_date,
    slotStart: r.slot_start,
    slotEnd: r.slot_end,
    tokenNo: r.token_no,
    patient: { id: r.patient_id, mrn: r.mrn, name: r.patient_name },
    doctor: { id: r.doctor_id, name: r.doctor_name, departmentName: r.department_name },
    checkedInAt: r.checked_in_at,
    cancelReason: r.cancel_reason,
    version: r.version,
  };
}

export async function appointmentById(db: Executor, id: string): Promise<Appointment> {
  const row = await maybeOne(db, sql`${APPOINTMENT_SELECT} where a.id = ${id}`, appointmentRow);
  if (!row) throw notFound();
  return toAppointment(row);
}

/**
 * Free slots for a doctor on a date, generated from their weekly hours in hospital time. A slot is
 * free when no booked, checked-in or in-consultation appointment overlaps it, no leave or block
 * covers it, and it hasn't started yet.
 */
function freeSlotsQuery(doctorId: string, date: string): SQL {
  return sql`with sched as (
      select s.id, s.start_time, s.end_time, s.slot_minutes from doctor_schedules s
       where s.doctor_id = ${doctorId} and s.active
         and s.weekday = extract(isodow from ${date}::date)
         and s.valid_from <= ${date}::date and (s.valid_to is null or s.valid_to >= ${date}::date)
    ), slots as (
      select sched.id as schedule_id, gs as slot_start, gs + make_interval(mins => sched.slot_minutes) as slot_end
        from sched, generate_series((${date}::date + sched.start_time) at time zone 'Asia/Kolkata',
                                    (${date}::date + sched.end_time) at time zone 'Asia/Kolkata' - make_interval(mins => sched.slot_minutes),
                                    make_interval(mins => sched.slot_minutes)) gs
    )
    select schedule_id, slot_start, slot_end from slots
     where slot_start > now()
       and not exists (select 1 from appointments a where a.doctor_id = ${doctorId}
                         and a.status in ('booked', 'checked_in', 'in_consultation') and a.slot_start is not null
                         and tstzrange(a.slot_start, a.slot_end) && tstzrange(slots.slot_start, slots.slot_end))
       and not exists (select 1 from schedule_exceptions x where x.doctor_id = ${doctorId} and x.active
                         and tstzrange(x.starts_at, x.ends_at) && tstzrange(slots.slot_start, slots.slot_end))
     order by slot_start`;
}

const slotRow = z.object({ schedule_id: z.uuid(), slot_start: timestamptz, slot_end: timestamptz });

async function lockAppointment(tx: Executor, id: string) {
  const row = await maybeOne(
    tx,
    sql`select a.id, a.status, a.kind, a.patient_id, a.doctor_id, a.visit_date::text as visit_date, a.follow_up_id,
               a.slot_start, a.visit_date < ${TODAY} as past, a.visit_date > ${TODAY} as future,
               (a.slot_start is not null and a.slot_start <= now()) as started
          from appointments a where a.id = ${id} for update`,
    z.object({
      id: z.uuid(),
      status: z.string(),
      kind: z.string(),
      patient_id: z.uuid(),
      doctor_id: z.uuid(),
      visit_date: dateText,
      follow_up_id: z.uuid().nullable(),
      slot_start: nullableTimestamptz,
      past: z.boolean(),
      future: z.boolean(),
      started: z.boolean(),
    }),
  );
  if (!row) throw notFound();
  return row;
}

/** Gapless token per doctor per day: serialized by an advisory lock on (doctor, date). */
async function nextToken(tx: Executor, doctorId: string, visitDate: string): Promise<number> {
  await run(
    tx,
    sql`select pg_advisory_xact_lock(hashtextextended(${`token:${doctorId}:${visitDate}`}, 0))`,
  );
  const row = await one(
    tx,
    sql`select coalesce(max(token_no), 0) + 1 as next from appointments where doctor_id = ${doctorId} and visit_date = ${visitDate}::date`,
    z.object({ next: z.number() }),
  );
  return row.next;
}

async function chargeConsultation(
  tx: Executor,
  appointmentId: string,
  doctorId: string,
  actorId: string,
) {
  const doctor = await one(
    tx,
    sql`select dp.consultation_fee_paise, e.full_name from doctor_profiles dp join employees e on e.id = dp.employee_id where dp.id = ${doctorId}`,
    z.object({
      consultation_fee_paise: z.union([z.string(), z.number()]).transform(Number),
      full_name: z.string(),
    }),
  );
  await addCharge(
    tx,
    appointmentId,
    {
      description: `Consultation: ${doctor.full_name}`,
      sourceType: 'consultation',
      consultationAppointmentId: appointmentId,
      qty: 1,
      unitPricePaise: doctor.consultation_fee_paise,
    },
    actorId,
  );
}

function mapSlotError(error: unknown): never {
  if (postgresErrorOf(error)?.code === PG.exclusionViolation) throw slotTaken();
  throw error;
}

export function createSchedulingService(db: Db) {
  async function availability(doctorId: string, date: string) {
    const doctor = await maybeOne(
      db,
      sql`select id from doctor_profiles where id = ${doctorId} and active`,
      z.object({ id: z.uuid() }),
    );
    if (!doctor) throw notFound();
    const slots = await many(db, freeSlotsQuery(doctorId, date), slotRow);
    return {
      doctorId,
      date,
      slots: slots.map((s) => ({
        start: s.slot_start,
        end: s.slot_end,
        scheduleId: s.schedule_id,
      })),
    };
  }

  /** The offered slot starting at `slotStart`, or a 409 if it isn't free (or doesn't exist). */
  async function findSlot(tx: Executor, doctorId: string, slotStart: string) {
    const day = await one(
      tx,
      sql`select ((${slotStart}::timestamptz) at time zone 'Asia/Kolkata')::date::text as d`,
      z.object({ d: dateText }),
    );
    const slots = await many(tx, freeSlotsQuery(doctorId, day.d), slotRow);
    const slot = slots.find((s) => s.slot_start === new Date(slotStart).toISOString());
    if (!slot) throw slotTaken();
    return { ...slot, visitDate: day.d };
  }

  return {
    availability,

    async list(
      actor: AuthContext,
      query: {
        date?: string | undefined;
        doctorId?: string | undefined;
        status?: string | undefined;
      },
    ) {
      // Doctors without appointment:read_all see only their own appointments.
      let doctorFilter = query.doctorId ?? null;
      if (!actor.permissions.has('appointment:read_all')) {
        const own = await doctorIdOf(db, actor.userId);
        if (!own) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
        doctorFilter = own;
      }
      const rows = await many(
        db,
        sql`${APPOINTMENT_SELECT}
             where a.visit_date = coalesce(${query.date ?? null}::date, ${TODAY})
               and (${doctorFilter}::uuid is null or a.doctor_id = ${doctorFilter}::uuid)
               and (${query.status ?? null}::text is null or a.status = ${query.status ?? null})
             order by a.token_no nulls last, a.slot_start nulls last, a.created_at
             limit 200`,
        appointmentRow,
      );
      return rows.map(toAppointment);
    },

    get: (id: string) => appointmentById(db, id),

    async book(
      actor: AuthContext,
      input: {
        patientId: string;
        doctorId: string;
        slotStart: string;
        followUpId?: string | undefined;
      },
      key: string,
      meta: RequestMeta,
    ) {
      return idempotent(db, actor.userId, key, 'appointment.book', input, async (tx) => {
        const patient = await maybeOne(
          tx,
          sql`select id from patients where id = ${input.patientId}`,
          z.object({ id: z.uuid() }),
        );
        if (!patient) throw notFound();
        const slot = await findSlot(tx, input.doctorId, input.slotStart);
        if (input.followUpId !== undefined) {
          const fu = await maybeOne(
            tx,
            sql`select status, patient_id from follow_ups where id = ${input.followUpId} for update`,
            z.object({ status: z.string(), patient_id: z.uuid() }),
          );
          if (!fu || fu.patient_id !== input.patientId) throw notFound();
          if (fu.status !== 'pending')
            throw unprocessable('This follow-up is not waiting to be booked.');
        }
        try {
          const row = await one(
            tx,
            sql`insert into appointments (patient_id, doctor_id, department_id, doctor_schedule_id, kind, visit_date, slot_start, slot_end,
                                          follow_up_id, created_by, updated_by)
                select ${input.patientId}, dp.id, dp.department_id, ${slot.schedule_id},
                       ${input.followUpId !== undefined ? 'follow_up' : 'scheduled'}, ${slot.visitDate}::date,
                       ${slot.slot_start}::timestamptz, ${slot.slot_end}::timestamptz, ${input.followUpId ?? null}, ${actor.userId}, ${actor.userId}
                  from doctor_profiles dp where dp.id = ${input.doctorId}
                returning id`,
            z.object({ id: z.uuid() }),
          );
          if (input.followUpId !== undefined) {
            await run(
              tx,
              sql`update follow_ups set status = 'booked', booked_appointment_id = ${row.id} where id = ${input.followUpId}`,
            );
          }
          await writeAudit(tx, userActor(actor.userId), meta, {
            action: 'appointment.booked',
            entityType: 'appointment',
            entityId: row.id,
            patientId: input.patientId,
            changes: {
              doctorId: input.doctorId,
              slotStart: slot.slot_start,
              followUpId: input.followUpId ?? null,
            },
          });
          return { status: 201, body: await appointmentById(tx, row.id) };
        } catch (error) {
          mapSlotError(error);
        }
      });
    },

    /** A walk-in is registered straight into the queue: token and consultation fee now. */
    async walkIn(
      actor: AuthContext,
      input: { patientId: string; doctorId: string },
      key: string,
      meta: RequestMeta,
    ) {
      return idempotent(db, actor.userId, key, 'appointment.walk_in', input, async (tx) => {
        const works = await maybeOne(
          tx,
          sql`select dp.id from doctor_profiles dp where dp.id = ${input.doctorId} and dp.active
                and exists (select 1 from doctor_schedules s where s.doctor_id = dp.id and s.active
                              and s.weekday = extract(isodow from ${TODAY}) and s.valid_from <= ${TODAY}
                              and (s.valid_to is null or s.valid_to >= ${TODAY}))`,
          z.object({ id: z.uuid() }),
        );
        if (!works) throw unprocessable('This doctor has no hours today.');
        const patient = await maybeOne(
          tx,
          sql`select id from patients where id = ${input.patientId}`,
          z.object({ id: z.uuid() }),
        );
        if (!patient) throw notFound();
        const today = await one(tx, sql`select ${TODAY}::text as d`, z.object({ d: dateText }));
        const token = await nextToken(tx, input.doctorId, today.d);
        const row = await one(
          tx,
          sql`insert into appointments (patient_id, doctor_id, department_id, kind, status, visit_date, token_no, checked_in_at, created_by, updated_by)
              select ${input.patientId}, dp.id, dp.department_id, 'walk_in', 'checked_in', ${today.d}::date, ${token}, now(), ${actor.userId}, ${actor.userId}
                from doctor_profiles dp where dp.id = ${input.doctorId}
              returning id`,
          z.object({ id: z.uuid() }),
        );
        await chargeConsultation(tx, row.id, input.doctorId, actor.userId);
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'appointment.walk_in',
          entityType: 'appointment',
          entityId: row.id,
          patientId: input.patientId,
          changes: { doctorId: input.doctorId, tokenNo: token },
        });
        return { status: 201, body: await appointmentById(tx, row.id) };
      });
    },

    /** Check-in (QU-1, CF-1): today's booked appointment gets a token and its consultation fee. */
    async checkIn(actor: AuthContext, appointmentId: string, key: string, meta: RequestMeta) {
      return idempotent(
        db,
        actor.userId,
        key,
        'appointment.check_in',
        { appointmentId },
        async (tx) => {
          const a = await lockAppointment(tx, appointmentId);
          if (a.status !== 'booked')
            throw unprocessable(
              `An appointment that is ${a.status.replace('_', ' ')} can't be checked in.`,
            );
          if (a.past)
            throw unprocessable(
              'This appointment was on an earlier day (did not arrive). Mark it as a no-show.',
            );
          if (a.future) throw unprocessable('This appointment is on a later day.');
          const token = await nextToken(tx, a.doctor_id, a.visit_date);
          await run(
            tx,
            sql`update appointments set status = 'checked_in', token_no = ${token}, checked_in_at = now(), version = version + 1,
                     updated_by = ${actor.userId} where id = ${appointmentId}`,
          );
          await chargeConsultation(tx, appointmentId, a.doctor_id, actor.userId);
          await writeAudit(tx, userActor(actor.userId), meta, {
            action: 'appointment.checked_in',
            entityType: 'appointment',
            entityId: appointmentId,
            patientId: a.patient_id,
            changes: { tokenNo: token },
          });
          return { status: 200, body: await appointmentById(tx, appointmentId) };
        },
      );
    },

    async cancel(actor: AuthContext, appointmentId: string, reason: string, meta: RequestMeta) {
      return transaction(db, async (tx) => {
        const a = await lockAppointment(tx, appointmentId);
        if (a.status !== 'booked' && a.status !== 'checked_in') {
          throw unprocessable(
            `An appointment that is ${a.status.replace('_', ' ')} can't be cancelled.`,
          );
        }
        await run(
          tx,
          sql`update appointments set status = 'cancelled', cancelled_at = now(), cancel_reason = ${reason}, version = version + 1,
                     updated_by = ${actor.userId} where id = ${appointmentId}`,
        );
        // Left before the consultation: the fee comes off the draft, or Finance gets a correction.
        const billing =
          a.status === 'checked_in'
            ? await cancelCharge(
                tx,
                { consultationAppointmentId: appointmentId },
                'appointment_cancel',
                reason,
                actor.userId,
                meta,
              )
            : 'none';
        if (a.follow_up_id !== null) {
          await run(
            tx,
            sql`update follow_ups set status = 'pending', booked_appointment_id = null where id = ${a.follow_up_id} and status = 'booked'`,
          );
        }
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'appointment.cancelled',
          entityType: 'appointment',
          entityId: appointmentId,
          patientId: a.patient_id,
          changes: { from: a.status, billing },
          reason,
        });
        return appointmentById(tx, appointmentId);
      });
    },

    /** Reschedule (booked only): the successor is created in the same transaction, or nothing changes. */
    async reschedule(
      actor: AuthContext,
      appointmentId: string,
      slotStart: string,
      reason: string,
      meta: RequestMeta,
    ) {
      try {
        return await transaction(db, async (tx) => {
          const a = await lockAppointment(tx, appointmentId);
          if (a.status !== 'booked')
            throw unprocessable('Only a booked appointment can be rescheduled.');
          await run(
            tx,
            sql`update appointments set status = 'rescheduled', version = version + 1, updated_by = ${actor.userId} where id = ${appointmentId}`,
          );
          const slot = await findSlot(tx, a.doctor_id, slotStart);
          const successor = await one(
            tx,
            sql`insert into appointments (patient_id, doctor_id, department_id, doctor_schedule_id, kind, visit_date, slot_start, slot_end,
                                          follow_up_id, rescheduled_from_id, created_by, updated_by)
                select patient_id, doctor_id, department_id, ${slot.schedule_id}, kind, ${slot.visitDate}::date,
                       ${slot.slot_start}::timestamptz, ${slot.slot_end}::timestamptz, follow_up_id, id, ${actor.userId}, ${actor.userId}
                  from appointments where id = ${appointmentId}
                returning id`,
            z.object({ id: z.uuid() }),
          );
          await run(
            tx,
            sql`update appointments set rescheduled_to_id = ${successor.id} where id = ${appointmentId}`,
          );
          if (a.follow_up_id !== null) {
            await run(
              tx,
              sql`update follow_ups set booked_appointment_id = ${successor.id} where id = ${a.follow_up_id}`,
            );
          }
          await writeAudit(tx, userActor(actor.userId), meta, {
            action: 'appointment.rescheduled',
            entityType: 'appointment',
            entityId: appointmentId,
            patientId: a.patient_id,
            changes: { successorId: successor.id, slotStart: slot.slot_start },
            reason,
          });
          return appointmentById(tx, successor.id);
        });
      } catch (error) {
        mapSlotError(error);
      }
    },

    async markNoShow(actor: AuthContext, appointmentId: string, meta: RequestMeta) {
      return transaction(db, async (tx) => {
        const a = await lockAppointment(tx, appointmentId);
        if (a.status !== 'booked')
          throw unprocessable('Only a booked appointment can be marked as a no-show.');
        if (!a.past && !a.started) throw unprocessable('The appointment time has not come yet.');
        await run(
          tx,
          sql`update appointments set status = 'no_show', no_show_at = now(), version = version + 1, updated_by = ${actor.userId} where id = ${appointmentId}`,
        );
        if (a.follow_up_id !== null) {
          await run(
            tx,
            sql`update follow_ups set status = 'missed' where id = ${a.follow_up_id} and status = 'booked'`,
          );
        }
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'appointment.no_show',
          entityType: 'appointment',
          entityId: appointmentId,
          patientId: a.patient_id,
        });
        return appointmentById(tx, appointmentId);
      });
    },

    /** Today's queue: checked-in and in-consultation patients, by token. */
    async queue(actor: AuthContext, doctorId?: string) {
      let doctorFilter = doctorId ?? null;
      if (!actor.permissions.has('appointment:read_all')) {
        doctorFilter = (await doctorIdOf(db, actor.userId)) ?? null;
        if (doctorFilter === null && !actor.roles.includes('NUR'))
          throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
      }
      const nurseOnly = !actor.permissions.has('appointment:read_all') && doctorFilter === null;
      const rows = await many(
        db,
        sql`${APPOINTMENT_SELECT}
             where a.visit_date = ${TODAY} and a.status in ('checked_in', 'in_consultation')
               and (${doctorFilter}::uuid is null or a.doctor_id = ${doctorFilter}::uuid)
               and (not ${nurseOnly} or exists (
                     select 1 from nurse_assignments na where na.nurse_user_id = ${actor.userId} and na.revoked_at is null
                        and na.doctor_id = a.doctor_id and na.session_date = a.visit_date
                        and (a.doctor_schedule_id is null or a.doctor_schedule_id = na.doctor_schedule_id)))
             order by a.doctor_id, a.token_no`,
        appointmentRow,
      );
      return rows.map(toAppointment);
    },
  };
}

export type SchedulingService = ReturnType<typeof createSchedulingService>;
