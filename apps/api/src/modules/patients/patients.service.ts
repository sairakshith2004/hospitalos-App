import type {
  PatientSummary,
  RegisterPatientRequest,
  UpdateDemographicsRequest,
} from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
import {
  dateText,
  many,
  maybeOne,
  one,
  run,
  timestamptz,
  transaction,
  type Db,
  type Executor,
} from '../../db/sql';
import type { AuthContext, RequestMeta } from '../../http/context';
import { AppError } from '../../lib/errors';
import { chartAccessOf, notFound, TODAY } from '../shared/access';

const patientRow = z.object({
  id: z.uuid(),
  mrn: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  dob: dateText,
  age_years: z.number(),
  sex: z.enum(['female', 'male', 'other', 'unknown']),
  phone: z.string(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  blood_group: z.string().nullable(),
  version: z.number(),
  created_at: timestamptz,
});
export const PATIENT_SELECT = sql`select p.id, p.mrn, p.first_name, p.last_name, p.dob::text as dob,
    date_part('year', age((now() at time zone 'Asia/Kolkata')::date, p.dob))::int as age_years,
    p.sex, p.phone, p.email::text as email, p.address, p.blood_group, p.version, p.created_at
  from patients p`;

export function toPatient(r: z.infer<typeof patientRow>): PatientSummary {
  return {
    id: r.id,
    mrn: r.mrn,
    firstName: r.first_name,
    lastName: r.last_name,
    dob: r.dob,
    ageYears: r.age_years,
    sex: r.sex,
    phone: r.phone,
    email: r.email,
    address: r.address,
    bloodGroup: r.blood_group,
    version: r.version,
    createdAt: r.created_at,
  };
}

export async function patientById(db: Executor, patientId: string): Promise<PatientSummary> {
  const row = await maybeOne(db, sql`${PATIENT_SELECT} where p.id = ${patientId}`, patientRow);
  if (!row) throw notFound();
  return toPatient(row);
}

/** `MRN000123`, `mrn 123` and `123` all mean MRN000123. */
export function normalizeMrn(q: string): string | null {
  const match = /^(?:mrn)?\s*0*(\d{1,9})$/i.exec(q.trim());
  return match?.[1] ? `MRN${match[1].padStart(6, '0')}` : null;
}

export type DuplicateCandidate = Readonly<{
  id: string;
  mrn: string;
  name: string;
  dob: string;
  phone: string;
  reason: 'same_phone_and_dob' | 'similar_name_and_dob';
}>;

export function createPatientsService(db: Db) {
  async function duplicates(input: RegisterPatientRequest): Promise<DuplicateCandidate[]> {
    const fullName = `${input.firstName} ${input.lastName}`;
    return many(
      db,
      sql`select id, mrn, first_name || ' ' || last_name as name, dob::text as dob, phone,
                 case when phone = ${input.phone} then 'same_phone_and_dob' else 'similar_name_and_dob' end as reason
            from patients
           where dob = ${input.dob}::date
             and (phone = ${input.phone} or similarity(first_name || ' ' || last_name, ${fullName}) >= 0.5)
           order by mrn limit 10`,
      z.object({
        id: z.uuid(),
        mrn: z.string(),
        name: z.string(),
        dob: dateText,
        phone: z.string(),
        reason: z.enum(['same_phone_and_dob', 'similar_name_and_dob']),
      }),
    );
  }

  return {
    /**
     * Registration (PR-1 to PR-4). Possible duplicates (same phone and birth date, or a similar name
     * and the same birth date) are shown to the registrar; patients are never merged automatically.
     */
    async register(
      actor: AuthContext,
      input: RegisterPatientRequest,
      meta: RequestMeta,
    ): Promise<
      | { kind: 'created'; patient: PatientSummary }
      | { kind: 'duplicates'; candidates: DuplicateCandidate[] }
    > {
      const today = await one(db, sql`select ${TODAY}::text as d`, z.object({ d: dateText }));
      if (input.dob > today.d) {
        throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
          { path: 'dob', message: 'Cannot be in the future' },
        ]);
      }
      if (!input.confirmNotDuplicate) {
        const candidates = await duplicates(input);
        if (candidates.length > 0) return { kind: 'duplicates', candidates };
      }
      const patientId = await transaction(db, async (tx) => {
        const row = await one(
          tx,
          sql`insert into patients (first_name, last_name, dob, sex, phone, email, address, blood_group, created_by, updated_by)
              values (${input.firstName}, ${input.lastName}, ${input.dob}::date, ${input.sex}, ${input.phone},
                      ${input.email ?? null}, ${input.address ?? null}, ${input.bloodGroup ?? null}, ${actor.userId}, ${actor.userId})
              returning id, mrn`,
          z.object({ id: z.uuid(), mrn: z.string() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'patient.created',
          entityType: 'patient',
          entityId: row.id,
          patientId: row.id,
          changes: { mrn: row.mrn, confirmedNotDuplicate: input.confirmNotDuplicate },
        });
        return row.id;
      });
      return { kind: 'created', patient: await patientById(db, patientId) };
    },

    /** Search by MRN, phone or name; at most 20 rows; every search is audited (no patient data). */
    async search(actor: AuthContext, q: string, meta: RequestMeta): Promise<PatientSummary[]> {
      const mrn = normalizeMrn(q);
      const digits = q.replace(/\D/g, '');
      const isPhone = mrn === null && /^[\d\s+-]+$/.test(q) && digits.length >= 7;
      const pattern = `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const rows = await many(
        db,
        mrn !== null
          ? sql`${PATIENT_SELECT} where p.mrn = ${mrn} limit 20`
          : isPhone
            ? sql`${PATIENT_SELECT} where p.phone like ${`%${digits.slice(-10)}`} order by p.last_name, p.first_name limit 20`
            : sql`${PATIENT_SELECT} where (p.first_name || ' ' || p.last_name) ilike ${pattern}
                                       or similarity(p.first_name || ' ' || p.last_name, ${q}) >= 0.3
                  order by similarity(p.first_name || ' ' || p.last_name, ${q}) desc, p.mrn limit 20`,
        patientRow,
      );
      await writeAudit(db, userActor(actor.userId), meta, {
        action: 'patient.record.listed',
        entityType: 'patient',
        changes: { by: mrn !== null ? 'mrn' : isPhone ? 'phone' : 'name', results: rows.length },
      });
      return rows.map(toPatient);
    },

    get: (patientId: string) => patientById(db, patientId),

    async updateDemographics(
      actor: AuthContext,
      patientId: string,
      input: UpdateDemographicsRequest,
      meta: RequestMeta,
    ): Promise<PatientSummary> {
      await transaction(db, async (tx) => {
        const current = await maybeOne(
          tx,
          sql`select version from patients where id = ${patientId} for update`,
          z.object({ version: z.number() }),
        );
        if (!current) throw notFound();
        if (current.version !== input.version) {
          throw new AppError(
            409,
            'STALE_VERSION',
            'Someone else changed this patient. Reload and try again.',
          );
        }
        await run(
          tx,
          sql`update patients set
                first_name = coalesce(${input.firstName ?? null}, first_name),
                last_name = coalesce(${input.lastName ?? null}, last_name),
                dob = coalesce(${input.dob ?? null}::date, dob),
                sex = coalesce(${input.sex ?? null}, sex),
                phone = coalesce(${input.phone ?? null}, phone),
                email = coalesce(${input.email ?? null}, email),
                address = coalesce(${input.address ?? null}, address),
                blood_group = coalesce(${input.bloodGroup ?? null}, blood_group),
                version = version + 1, updated_by = ${actor.userId}
              where id = ${patientId}`,
        );
        const { version: _version, ...fields } = input;
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'patient.demographics_updated',
          entityType: 'patient',
          entityId: patientId,
          patientId,
          changes: { fields: Object.keys(fields) },
        });
      });
      return patientById(db, patientId);
    },

    async recordAllergy(
      actor: AuthContext,
      patientId: string,
      input: {
        substance: string;
        reaction?: string | undefined;
        severity: 'mild' | 'moderate' | 'severe' | 'unknown';
      },
      meta: RequestMeta,
    ) {
      if ((await chartAccessOf(db, actor, patientId)) === null) throw notFound();
      return transaction(db, async (tx) => {
        const row = await one(
          tx,
          sql`insert into allergies (patient_id, substance, ingredient_id, reaction, severity, created_by, updated_by)
              values (${patientId}, ${input.substance},
                      (select id from ingredients where lower(name) = lower(${input.substance}) limit 1),
                      ${input.reaction ?? null}, ${input.severity}, ${actor.userId}, ${actor.userId})
              returning id`,
          z.object({ id: z.uuid() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'allergy.recorded',
          entityType: 'allergy',
          entityId: row.id,
          patientId,
        });
        return row.id;
      });
    },

    async visits(patientId: string) {
      await patientById(db, patientId);
      const rows = await many(
        db,
        sql`select a.id, a.appointment_no, a.visit_date::text as visit_date, a.status, e.full_name as doctor_name, d.name as department_name
              from appointments a join doctor_profiles dp on dp.id = a.doctor_id join employees e on e.id = dp.employee_id
              join departments d on d.id = a.department_id
             where a.patient_id = ${patientId} order by a.visit_date desc, a.created_at desc limit 50`,
        z.object({
          id: z.uuid(),
          appointment_no: z.string(),
          visit_date: dateText,
          status: z.string(),
          doctor_name: z.string(),
          department_name: z.string(),
        }),
      );
      return rows.map((r) => ({
        appointmentId: r.id,
        appointmentNo: r.appointment_no,
        visitDate: r.visit_date,
        status: r.status,
        doctorName: r.doctor_name,
        departmentName: r.department_name,
      }));
    },
  };
}

export type PatientsService = ReturnType<typeof createPatientsService>;
