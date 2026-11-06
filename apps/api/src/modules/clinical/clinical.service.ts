import type { Encounter } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
import {
  dateText,
  many,
  maybeOne,
  nullableTimestamptz,
  one,
  run,
  timestamptz,
  transaction,
  type Db,
  type Executor,
} from '../../db/sql';
import type { AuthContext, RequestMeta } from '../../http/context';
import { AppError } from '../../lib/errors';
import { patientById } from '../patients/patients.service';
import {
  chartAccessOf,
  doctorIdOf,
  notFound,
  nurseCanSeeAppointment,
  requireDoctorId,
  TODAY,
} from '../shared/access';

const invalidState = (message: string) => new AppError(422, 'INVALID_STATE', message);
const num = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null ? null : Number(v)));

async function encounterRow(db: Executor, encounterId: string) {
  return maybeOne(
    db,
    sql`select e.id, e.encounter_no, e.appointment_id, e.patient_id, e.doctor_id, e.status, e.chief_complaint,
               e.started_at, e.completed_at
          from encounters e where e.id = ${encounterId}`,
    z.object({
      id: z.uuid(),
      encounter_no: z.string(),
      appointment_id: z.uuid(),
      patient_id: z.uuid(),
      doctor_id: z.uuid(),
      status: z.enum(['in_progress', 'completed', 'entered_in_error']),
      chief_complaint: z.string().nullable(),
      started_at: timestamptz,
      completed_at: nullableTimestamptz,
    }),
  );
}

export async function encounterById(db: Executor, encounterId: string): Promise<Encounter> {
  const e = await encounterRow(db, encounterId);
  if (!e) throw notFound();
  const notes = await many(
    db,
    sql`select n.id, n.kind, n.body, emp.full_name as author, n.created_at
          from clinical_notes n join users u on u.id = n.author_id join employees emp on emp.id = u.employee_id
         where n.encounter_id = ${encounterId} order by n.created_at`,
    z.object({
      id: z.uuid(),
      kind: z.string(),
      body: z.string(),
      author: z.string(),
      created_at: timestamptz,
    }),
  );
  const diagnoses = await many(
    db,
    sql`select id, description, code, is_primary from diagnoses where encounter_id = ${encounterId} order by is_primary desc, created_at`,
    z.object({
      id: z.uuid(),
      description: z.string(),
      code: z.string().nullable(),
      is_primary: z.boolean(),
    }),
  );
  return {
    id: e.id,
    encounterNo: e.encounter_no,
    appointmentId: e.appointment_id,
    patientId: e.patient_id,
    status: e.status,
    chiefComplaint: e.chief_complaint,
    startedAt: e.started_at,
    completedAt: e.completed_at,
    notes: notes.map((n) => ({
      id: n.id,
      kind: n.kind,
      body: n.body,
      author: n.author,
      createdAt: n.created_at,
    })),
    diagnoses: diagnoses.map((d) => ({
      id: d.id,
      description: d.description,
      code: d.code,
      isPrimary: d.is_primary,
    })),
  };
}

/** The encounter, locked, if it belongs to this doctor; otherwise 404. */
export async function ownEncounter(tx: Executor, auth: AuthContext, encounterId: string) {
  const doctorId = await requireDoctorId(tx, auth);
  const e = await maybeOne(
    tx,
    sql`select id, appointment_id, patient_id, status from encounters where id = ${encounterId} and doctor_id = ${doctorId} for update`,
    z.object({
      id: z.uuid(),
      appointment_id: z.uuid(),
      patient_id: z.uuid(),
      status: z.enum(['in_progress', 'completed', 'entered_in_error']),
    }),
  );
  if (!e) throw notFound();
  return { ...e, doctorId };
}

export function createClinicalService(db: Db) {
  return {
    async start(
      actor: AuthContext,
      appointmentId: string,
      chiefComplaint: string | undefined,
      meta: RequestMeta,
    ): Promise<Encounter> {
      const id = await transaction(db, async (tx) => {
        const doctorId = await requireDoctorId(tx, actor);
        const a = await maybeOne(
          tx,
          sql`select id, status, patient_id from appointments where id = ${appointmentId} and doctor_id = ${doctorId} for update`,
          z.object({ id: z.uuid(), status: z.string(), patient_id: z.uuid() }),
        );
        if (!a) throw notFound();
        if (a.status !== 'checked_in')
          throw invalidState('Start the consultation after the patient has checked in.');
        const row = await one(
          tx,
          sql`insert into encounters (appointment_id, patient_id, doctor_id, chief_complaint, created_by)
              values (${appointmentId}, ${a.patient_id}, ${doctorId}, ${chiefComplaint ?? null}, ${actor.userId}) returning id`,
          z.object({ id: z.uuid() }),
        );
        await run(
          tx,
          sql`update appointments set status = 'in_consultation', consult_started_at = now(), version = version + 1 where id = ${appointmentId}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'encounter.started',
          entityType: 'encounter',
          entityId: row.id,
          patientId: a.patient_id,
        });
        return row.id;
      });
      return encounterById(db, id);
    },

    async get(actor: AuthContext, encounterId: string, meta: RequestMeta): Promise<Encounter> {
      const e = await encounterRow(db, encounterId);
      if (!e || (await chartAccessOf(db, actor, e.patient_id)) === null) throw notFound();
      await writeAudit(db, userActor(actor.userId), meta, {
        action: 'encounter.viewed',
        entityType: 'encounter',
        entityId: encounterId,
        patientId: e.patient_id,
      });
      return encounterById(db, encounterId);
    },

    async addNote(
      actor: AuthContext,
      encounterId: string,
      kind: 'symptoms' | 'observation' | 'plan' | 'addendum',
      body: string,
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const e = await ownEncounter(tx, actor, encounterId);
        if (kind === 'addendum' ? e.status !== 'completed' : e.status !== 'in_progress') {
          throw invalidState(
            kind === 'addendum'
              ? 'Addenda are added after the encounter is completed.'
              : 'This encounter is closed: add an addendum instead.',
          );
        }
        const note = await one(
          tx,
          sql`insert into clinical_notes (encounter_id, kind, body, author_id) values (${encounterId}, ${kind}, ${body}, ${actor.userId}) returning id`,
          z.object({ id: z.uuid() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'clinical_note.added',
          entityType: 'clinical_note',
          entityId: note.id,
          patientId: e.patient_id,
          changes: { kind },
        });
      });
      return encounterById(db, encounterId);
    },

    async addDiagnosis(
      actor: AuthContext,
      encounterId: string,
      input: { description: string; code?: string | undefined; isPrimary: boolean },
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const e = await ownEncounter(tx, actor, encounterId);
        if (e.status !== 'in_progress')
          throw invalidState('Diagnoses are recorded during the consultation.');
        const row = await one(
          tx,
          sql`insert into diagnoses (encounter_id, description, code, is_primary, created_by)
              values (${encounterId}, ${input.description}, ${input.code ?? null}, ${input.isPrimary}, ${actor.userId}) returning id`,
          z.object({ id: z.uuid() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'diagnosis.added',
          entityType: 'diagnosis',
          entityId: row.id,
          patientId: e.patient_id,
        });
      });
      return encounterById(db, encounterId);
    },

    /** Completes the encounter and its appointment together (CN-1); a linked follow-up completes too. */
    async complete(actor: AuthContext, encounterId: string, meta: RequestMeta): Promise<Encounter> {
      await transaction(db, async (tx) => {
        const e = await ownEncounter(tx, actor, encounterId);
        if (e.status !== 'in_progress') throw invalidState('This encounter is not in progress.');
        await run(
          tx,
          sql`update encounters set status = 'completed', completed_at = now() where id = ${encounterId}`,
        );
        await run(
          tx,
          sql`update appointments set status = 'completed', completed_at = now(), version = version + 1 where id = ${e.appointment_id}`,
        );
        await run(
          tx,
          sql`update follow_ups f set status = 'completed' from appointments a
               where a.id = ${e.appointment_id} and f.id = a.follow_up_id and f.status = 'booked'`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'encounter.completed',
          entityType: 'encounter',
          entityId: encounterId,
          patientId: e.patient_id,
        });
      });
      return encounterById(db, encounterId);
    },

    /** Entered in error: only before any prescription or lab order; the patient returns to the queue. */
    async enteredInError(
      actor: AuthContext,
      encounterId: string,
      reason: string,
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const e = await ownEncounter(tx, actor, encounterId);
        if (e.status !== 'in_progress')
          throw invalidState('Only an encounter in progress can be marked as entered in error.');
        const orders = await one(
          tx,
          sql`select (select count(*) from prescriptions where encounter_id = ${encounterId})::int
                   + (select count(*) from lab_orders where encounter_id = ${encounterId})::int as n`,
          z.object({ n: z.number() }),
        );
        if (orders.n > 0)
          throw invalidState(
            'This encounter has prescriptions or lab orders, so it cannot be marked as entered in error.',
          );
        await run(
          tx,
          sql`update encounters set status = 'entered_in_error', error_reason = ${reason} where id = ${encounterId}`,
        );
        await run(
          tx,
          sql`update appointments set status = 'checked_in', consult_started_at = null, version = version + 1 where id = ${e.appointment_id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'encounter.entered_in_error',
          entityType: 'encounter',
          entityId: encounterId,
          patientId: e.patient_id,
          reason,
        });
      });
    },

    /** Vitals: by the patient's doctor or a nurse assigned to today's session (QU-4, AX-7). */
    async recordVitals(
      actor: AuthContext,
      input: {
        appointmentId: string;
        tempC?: number | undefined;
        pulse?: number | undefined;
        bpSys?: number | undefined;
        bpDia?: number | undefined;
        respRate?: number | undefined;
        spo2?: number | undefined;
        weightKg?: number | undefined;
        heightCm?: number | undefined;
      },
      meta: RequestMeta,
    ) {
      return transaction(db, async (tx) => {
        const a = await maybeOne(
          tx,
          sql`select id, patient_id, doctor_id, status, visit_date = ${TODAY} as today from appointments where id = ${input.appointmentId}`,
          z.object({
            id: z.uuid(),
            patient_id: z.uuid(),
            doctor_id: z.uuid(),
            status: z.string(),
            today: z.boolean(),
          }),
        );
        if (!a) throw notFound();
        const doctorId = await doctorIdOf(tx, actor.userId);
        const allowed =
          actor.roles.includes('SA') ||
          (doctorId !== undefined && doctorId === a.doctor_id) ||
          (actor.roles.includes('NUR') && (await nurseCanSeeAppointment(tx, actor.userId, a.id)));
        if (!allowed) throw notFound();
        if (!a.today || (a.status !== 'checked_in' && a.status !== 'in_consultation')) {
          throw invalidState('Vitals are recorded for patients checked in today.');
        }
        const row = await one(
          tx,
          sql`insert into vital_signs (appointment_id, patient_id, recorded_by, temp_c, pulse, bp_sys, bp_dia, resp_rate, spo2, weight_kg, height_cm)
              values (${a.id}, ${a.patient_id}, ${actor.userId}, ${input.tempC ?? null}, ${input.pulse ?? null}, ${input.bpSys ?? null},
                      ${input.bpDia ?? null}, ${input.respRate ?? null}, ${input.spo2 ?? null}, ${input.weightKg ?? null}, ${input.heightCm ?? null})
              returning id`,
          z.object({ id: z.uuid() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'vitals.recorded',
          entityType: 'vital_signs',
          entityId: row.id,
          patientId: a.patient_id,
        });
        return row.id;
      });
    },

    /**
     * The patient chart. The audit row is written before any clinical data is returned; if it
     * can't be written, nothing is returned (architecture §3 rule 7).
     */
    async chart(actor: AuthContext, patientId: string, meta: RequestMeta) {
      const access = await chartAccessOf(db, actor, patientId);
      if (access === null) throw notFound();
      await writeAudit(db, userActor(actor.userId), meta, {
        action: 'patient.chart.viewed',
        entityType: 'patient',
        entityId: patientId,
        patientId,
        changes: { access },
      });
      const patient = await patientById(db, patientId);
      const allergies = await many(
        db,
        sql`select id, substance, reaction, severity, status, created_at from allergies where patient_id = ${patientId} order by status, created_at desc`,
        z.object({
          id: z.uuid(),
          substance: z.string(),
          reaction: z.string().nullable(),
          severity: z.enum(['mild', 'moderate', 'severe', 'unknown']),
          status: z.enum(['active', 'inactive']),
          created_at: timestamptz,
        }),
      );
      const vitals = await many(
        db,
        sql`select v.id, v.recorded_at, emp.full_name as recorded_by, v.temp_c, v.pulse, v.bp_sys, v.bp_dia, v.resp_rate, v.spo2, v.weight_kg, v.height_cm
              from vital_signs v join users u on u.id = v.recorded_by join employees emp on emp.id = u.employee_id
             where v.patient_id = ${patientId} and not v.entered_in_error order by v.recorded_at desc limit 20`,
        z.object({
          id: z.uuid(),
          recorded_at: timestamptz,
          recorded_by: z.string(),
          temp_c: num,
          pulse: num,
          bp_sys: num,
          bp_dia: num,
          resp_rate: num,
          spo2: num,
          weight_kg: num,
          height_cm: num,
        }),
      );
      // Nurses see vitals and allergies for today's care; consultation records stay with clinicians.
      const encounterIds =
        access === 'nurse'
          ? []
          : await many(
              db,
              sql`select id from encounters where patient_id = ${patientId} and status <> 'entered_in_error' order by started_at desc limit 20`,
              z.object({ id: z.uuid() }),
            );
      const encounters = [];
      for (const { id } of encounterIds) encounters.push(await encounterById(db, id));
      const labRows =
        access === 'nurse'
          ? []
          : await many(
              db,
              sql`select o.id, o.order_no, t.name as test_name, o.verified_at,
                         coalesce((select json_agg(json_build_object('parameter', p.name,
                                     'value', coalesce(r.value_num::text, r.value_text), 'unit', r.unit, 'flag', r.abnormal_flag) order by p.sort_order)
                                     from lab_results r join lab_test_parameters p on p.id = r.parameter_id
                                    where r.order_id = o.id and r.is_current), '[]'::json) as results
                    from lab_orders o join lab_tests t on t.id = o.test_id
                   where o.patient_id = ${patientId} and o.status = 'verified' order by o.verified_at desc limit 20`,
              z.object({
                id: z.uuid(),
                order_no: z.string(),
                test_name: z.string(),
                verified_at: timestamptz,
                results: z.array(
                  z.object({
                    parameter: z.string(),
                    value: z.string(),
                    unit: z.string().nullable(),
                    flag: z.string().nullable(),
                  }),
                ),
              }),
            );
      return {
        patient,
        allergies: allergies.map((a) => ({
          id: a.id,
          substance: a.substance,
          reaction: a.reaction,
          severity: a.severity,
          status: a.status,
          recordedAt: a.created_at,
        })),
        vitals: vitals.map((v) => ({
          id: v.id,
          recordedAt: v.recorded_at,
          recordedBy: v.recorded_by,
          tempC: v.temp_c,
          pulse: v.pulse,
          bpSys: v.bp_sys,
          bpDia: v.bp_dia,
          respRate: v.resp_rate,
          spo2: v.spo2,
          weightKg: v.weight_kg,
          heightCm: v.height_cm,
        })),
        encounters,
        labResults: labRows.map((l) => ({
          orderId: l.id,
          orderNo: l.order_no,
          testName: l.test_name,
          verifiedAt: l.verified_at,
          results: l.results,
        })),
      };
    },

    // Nurse session assignments (nurse_assignment:manage) ----------------------------------------
    async assignNurse(
      actor: AuthContext,
      input: { nurseUserId: string; doctorScheduleId: string; sessionDate: string },
      meta: RequestMeta,
    ) {
      return transaction(db, async (tx) => {
        const nurse = await maybeOne(
          tx,
          sql`select u.id from users u join user_roles ur on ur.user_id = u.id join roles r on r.id = ur.role_id and r.code = 'NUR'
               where u.id = ${input.nurseUserId} and u.status = 'active'`,
          z.object({ id: z.uuid() }),
        );
        if (!nurse)
          throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
            { path: 'nurseUserId', message: 'Not an active nurse' },
          ]);
        const schedule = await maybeOne(
          tx,
          sql`select id, doctor_id from doctor_schedules
               where id = ${input.doctorScheduleId} and active and weekday = extract(isodow from ${input.sessionDate}::date)
                 and valid_from <= ${input.sessionDate}::date and (valid_to is null or valid_to >= ${input.sessionDate}::date)`,
          z.object({ id: z.uuid(), doctor_id: z.uuid() }),
        );
        if (!schedule)
          throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
            { path: 'doctorScheduleId', message: 'The doctor has no such session on that date' },
          ]);
        const existing = await maybeOne(
          tx,
          sql`select id from nurse_assignments where nurse_user_id = ${input.nurseUserId} and doctor_schedule_id = ${input.doctorScheduleId}
                 and session_date = ${input.sessionDate}::date and revoked_at is null`,
          z.object({ id: z.uuid() }),
        );
        if (existing)
          throw new AppError(409, 'CONFLICT', 'This nurse is already assigned to that session.');
        const row = await one(
          tx,
          sql`insert into nurse_assignments (nurse_user_id, doctor_id, doctor_schedule_id, session_date, assigned_by)
              values (${input.nurseUserId}, ${schedule.doctor_id}, ${schedule.id}, ${input.sessionDate}::date, ${actor.userId}) returning id`,
          z.object({ id: z.uuid() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'nurse_assignment.created',
          entityType: 'nurse_assignment',
          entityId: row.id,
          changes: {
            nurseUserId: input.nurseUserId,
            doctorScheduleId: input.doctorScheduleId,
            sessionDate: input.sessionDate,
          },
        });
        return row.id;
      });
    },

    async revokeNurseAssignment(
      actor: AuthContext,
      assignmentId: string,
      reason: string,
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const changed = await run(
          tx,
          sql`update nurse_assignments set revoked_at = now(), revoked_by = ${actor.userId}, revoke_reason = ${reason}
               where id = ${assignmentId} and revoked_at is null`,
        );
        if (changed === 0) throw notFound();
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'nurse_assignment.revoked',
          entityType: 'nurse_assignment',
          entityId: assignmentId,
          reason,
        });
      });
    },

    async nurseAssignments(actor: AuthContext, date: string | undefined, mineOnly: boolean) {
      const rows = await many(
        db,
        sql`select na.id, na.nurse_user_id, ne.full_name as nurse_name, na.doctor_id, de.full_name as doctor_name, na.doctor_schedule_id,
                   na.session_date::text as session_date, to_char(s.start_time, 'HH24:MI') as start_time, to_char(s.end_time, 'HH24:MI') as end_time
              from nurse_assignments na
              join users nu on nu.id = na.nurse_user_id join employees ne on ne.id = nu.employee_id
              join doctor_profiles dp on dp.id = na.doctor_id join employees de on de.id = dp.employee_id
              join doctor_schedules s on s.id = na.doctor_schedule_id
             where na.revoked_at is null and na.session_date = coalesce(${date ?? null}::date, ${TODAY})
               and (not ${mineOnly} or na.nurse_user_id = ${actor.userId})
             order by s.start_time, de.full_name`,
        z.object({
          id: z.uuid(),
          nurse_user_id: z.uuid(),
          nurse_name: z.string(),
          doctor_id: z.uuid(),
          doctor_name: z.string(),
          doctor_schedule_id: z.uuid(),
          session_date: dateText,
          start_time: z.string(),
          end_time: z.string(),
        }),
      );
      return rows.map((r) => ({
        id: r.id,
        nurseUserId: r.nurse_user_id,
        nurseName: r.nurse_name,
        doctorId: r.doctor_id,
        doctorName: r.doctor_name,
        scheduleId: r.doctor_schedule_id,
        sessionDate: r.session_date,
        startTime: r.start_time,
        endTime: r.end_time,
      }));
    },

    // Follow-ups (phase 1.10) ---------------------------------------------------------------------
    async recommendFollowUp(
      actor: AuthContext,
      encounterId: string,
      input: {
        reason: string;
        instructions?: string | undefined;
        dueFrom: string;
        dueTo: string;
        targetDoctorId?: string | undefined;
      },
      meta: RequestMeta,
    ) {
      if (input.dueFrom > input.dueTo) {
        throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
          { path: 'dueTo', message: 'Must be on or after the start of the window' },
        ]);
      }
      return transaction(db, async (tx) => {
        const e = await ownEncounter(tx, actor, encounterId);
        if (e.status === 'entered_in_error')
          throw invalidState('This encounter was entered in error.');
        const row = await one(
          tx,
          sql`insert into follow_ups (patient_id, source_encounter_id, recommended_by, target_doctor_id, reason, instructions, due_from, due_to)
              values (${e.patient_id}, ${encounterId}, ${actor.userId}, ${input.targetDoctorId ?? e.doctorId}, ${input.reason},
                      ${input.instructions ?? null}, ${input.dueFrom}::date, ${input.dueTo}::date)
              returning id`,
          z.object({ id: z.uuid() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'follow_up.recommended',
          entityType: 'follow_up',
          entityId: row.id,
          patientId: e.patient_id,
        });
        return row.id;
      });
    },

    async followUps(actor: AuthContext, status: string | undefined) {
      const ownDoctor = actor.permissions.has('followup:schedule')
        ? null
        : ((await doctorIdOf(db, actor.userId)) ?? null);
      if (!actor.permissions.has('followup:schedule') && ownDoctor === null)
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
      const rows = await many(
        db,
        sql`select f.id, p.id as patient_id, p.mrn, p.first_name || ' ' || p.last_name as patient_name, f.reason, f.instructions,
                   f.due_from::text as due_from, f.due_to::text as due_to, f.status, f.target_doctor_id, f.booked_appointment_id,
                   case when f.status <> 'pending' then 'none'
                        when f.due_to < ${TODAY} then 'overdue'
                        when f.due_from <= ${TODAY} then 'due' else 'upcoming' end as timing
              from follow_ups f join patients p on p.id = f.patient_id
             where (${status ?? null}::text is null or f.status = ${status ?? null})
               and (${ownDoctor}::uuid is null or f.target_doctor_id = ${ownDoctor}::uuid)
             order by f.due_to, f.created_at limit 200`,
        z.object({
          id: z.uuid(),
          patient_id: z.uuid(),
          mrn: z.string(),
          patient_name: z.string(),
          reason: z.string(),
          instructions: z.string().nullable(),
          due_from: dateText,
          due_to: dateText,
          status: z.enum(['pending', 'booked', 'completed', 'missed', 'cancelled']),
          target_doctor_id: z.uuid().nullable(),
          booked_appointment_id: z.uuid().nullable(),
          timing: z.enum(['upcoming', 'due', 'overdue', 'none']),
        }),
      );
      return rows.map((r) => ({
        id: r.id,
        patient: { id: r.patient_id, mrn: r.mrn, name: r.patient_name },
        reason: r.reason,
        instructions: r.instructions,
        dueFrom: r.due_from,
        dueTo: r.due_to,
        status: r.status,
        timing: r.timing,
        targetDoctorId: r.target_doctor_id,
        bookedAppointmentId: r.booked_appointment_id,
      }));
    },

    async cancelFollowUp(
      actor: AuthContext,
      followUpId: string,
      reason: string,
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const f = await maybeOne(
          tx,
          sql`select status, patient_id, target_doctor_id from follow_ups where id = ${followUpId} for update`,
          z.object({
            status: z.string(),
            patient_id: z.uuid(),
            target_doctor_id: z.uuid().nullable(),
          }),
        );
        if (!f) throw notFound();
        if (!actor.permissions.has('followup:schedule')) {
          const own = await doctorIdOf(tx, actor.userId);
          if (own === undefined || own !== f.target_doctor_id) throw notFound();
        }
        if (f.status !== 'pending')
          throw invalidState('Only a follow-up waiting to be booked can be cancelled.');
        await run(
          tx,
          sql`update follow_ups set status = 'cancelled', cancel_reason = ${reason} where id = ${followUpId}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'follow_up.cancelled',
          entityType: 'follow_up',
          entityId: followUpId,
          patientId: f.patient_id,
          reason,
        });
      });
    },
  };
}

export type ClinicalService = ReturnType<typeof createClinicalService>;
