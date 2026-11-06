import type { LabOrder } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
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
import { addCharge, cancelCharge } from '../billing/billing.core';
import { ownEncounter } from '../clinical/clinical.service';
import { doctorIdOf, notFound } from '../shared/access';

const invalidState = (message: string) => new AppError(422, 'INVALID_STATE', message);
const nullableNum = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null ? null : Number(v)));

const STATUSES = [
  'ordered',
  'sample_collected',
  'in_process',
  'resulted',
  'verified',
  'cancelled',
] as const;

export async function labOrderById(db: Executor, id: string): Promise<LabOrder> {
  const o = await maybeOne(
    db,
    sql`select o.id, o.order_no, o.status, o.priority, o.created_at, o.sample_barcode, o.resulted_by,
               t.id as test_id, t.code as test_code, t.name as test_name, t.sample_type,
               p.id as patient_id, p.mrn, p.first_name || ' ' || p.last_name as patient_name
          from lab_orders o join lab_tests t on t.id = o.test_id join patients p on p.id = o.patient_id where o.id = ${id}`,
    z.object({
      id: z.uuid(),
      order_no: z.string(),
      status: z.enum(STATUSES),
      priority: z.enum(['routine', 'urgent']),
      created_at: timestamptz,
      sample_barcode: z.string().nullable(),
      resulted_by: z.uuid().nullable(),
      test_id: z.uuid(),
      test_code: z.string(),
      test_name: z.string(),
      sample_type: z.string(),
      patient_id: z.uuid(),
      mrn: z.string(),
      patient_name: z.string(),
    }),
  );
  if (!o) throw notFound();
  const results = await many(
    db,
    sql`select p.id as parameter_id, p.name, r.value_num, r.value_text, coalesce(r.unit, p.unit) as unit,
               coalesce(r.ref_low, p.ref_low) as ref_low, coalesce(r.ref_high, p.ref_high) as ref_high, r.abnormal_flag
          from lab_test_parameters p left join lab_results r on r.parameter_id = p.id and r.order_id = ${id} and r.is_current
         where p.test_id = ${o.test_id} order by p.sort_order`,
    z.object({
      parameter_id: z.uuid(),
      name: z.string(),
      value_num: nullableNum,
      value_text: z.string().nullable(),
      unit: z.string().nullable(),
      ref_low: nullableNum,
      ref_high: nullableNum,
      abnormal_flag: z.enum(['low', 'normal', 'high']).nullable(),
    }),
  );
  return {
    id: o.id,
    orderNo: o.order_no,
    status: o.status,
    priority: o.priority,
    test: { id: o.test_id, code: o.test_code, name: o.test_name, sampleType: o.sample_type },
    patient: { id: o.patient_id, mrn: o.mrn, name: o.patient_name },
    orderedAt: o.created_at,
    sampleBarcode: o.sample_barcode,
    resultedBy: o.resulted_by,
    results: results.map((r) => ({
      parameterId: r.parameter_id,
      parameter: r.name,
      valueNum: r.value_num,
      valueText: r.value_text,
      unit: r.unit,
      refLow: r.ref_low,
      refHigh: r.ref_high,
      flag: r.abnormal_flag,
    })),
  };
}

/** Factual flag against the configured range only; never an interpretation. */
export function flagOf(
  value: number | undefined,
  low: number | null,
  high: number | null,
): 'low' | 'normal' | 'high' | null {
  if (value === undefined || (low === null && high === null)) return null;
  if (low !== null && value < low) return 'low';
  if (high !== null && value > high) return 'high';
  return 'normal';
}

async function lockOrder(tx: Executor, id: string) {
  const row = await maybeOne(
    tx,
    sql`select id, status, patient_id, test_id, ordered_by, resulted_by from lab_orders where id = ${id} for update`,
    z.object({
      id: z.uuid(),
      status: z.enum(STATUSES),
      patient_id: z.uuid(),
      test_id: z.uuid(),
      ordered_by: z.uuid(),
      resulted_by: z.uuid().nullable(),
    }),
  );
  if (!row) throw notFound();
  return row;
}

export function createLabService(db: Db) {
  async function transition(
    actor: AuthContext,
    id: string,
    from: readonly string[],
    to: string,
    extra: ReturnType<typeof sql>,
    action: string,
    meta: RequestMeta,
    reason?: string,
  ) {
    await transaction(db, async (tx) => {
      const o = await lockOrder(tx, id);
      if (!from.includes(o.status))
        throw invalidState(`This order is ${o.status.replace('_', ' ')}.`);
      await run(tx, sql`update lab_orders set status = ${to}, ${extra} where id = ${id}`);
      await writeAudit(tx, userActor(actor.userId), meta, {
        action,
        entityType: 'lab_order',
        entityId: id,
        patientId: o.patient_id,
        reason: reason ?? null,
      });
    });
    return labOrderById(db, id);
  }

  return {
    /** A doctor orders a test during their consultation; the charge goes on the visit's draft invoice. */
    async order(
      actor: AuthContext,
      encounterId: string,
      input: { testId: string; priority: 'routine' | 'urgent'; clinicalNotes?: string | undefined },
      meta: RequestMeta,
    ) {
      const id = await transaction(db, async (tx) => {
        const e = await ownEncounter(tx, actor, encounterId);
        if (e.status !== 'in_progress')
          throw invalidState('Lab tests are ordered during the consultation.');
        const test = await maybeOne(
          tx,
          sql`select t.id, t.name, s.id as service_id, s.price_paise from lab_tests t join service_catalogue s on s.id = t.service_id
               where t.id = ${input.testId} and t.active and s.active`,
          z.object({
            id: z.uuid(),
            name: z.string(),
            service_id: z.uuid(),
            price_paise: z.union([z.string(), z.number()]).transform(Number),
          }),
        );
        if (!test)
          throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
            { path: 'testId', message: 'Unknown test' },
          ]);
        const row = await one(
          tx,
          sql`insert into lab_orders (encounter_id, patient_id, test_id, ordered_by, priority, clinical_notes)
              values (${encounterId}, ${e.patient_id}, ${test.id}, ${actor.userId}, ${input.priority}, ${input.clinicalNotes ?? null}) returning id`,
          z.object({ id: z.uuid() }),
        );
        await addCharge(
          tx,
          e.appointment_id,
          {
            description: `Lab: ${test.name}`,
            sourceType: 'lab',
            serviceId: test.service_id,
            labOrderId: row.id,
            qty: 1,
            unitPricePaise: test.price_paise,
          },
          actor.userId,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'lab_order.created',
          entityType: 'lab_order',
          entityId: row.id,
          patientId: e.patient_id,
        });
        return row.id;
      });
      return labOrderById(db, id);
    },

    /** Before collection only; the charge is deactivated on a draft or corrected on an issued invoice. */
    async cancel(actor: AuthContext, id: string, reason: string, meta: RequestMeta) {
      await transaction(db, async (tx) => {
        const o = await lockOrder(tx, id);
        const own = await doctorIdOf(tx, actor.userId);
        const ordering = await maybeOne(
          tx,
          sql`select e.doctor_id from lab_orders o join encounters e on e.id = o.encounter_id where o.id = ${id}`,
          z.object({ doctor_id: z.uuid() }),
        );
        if (own === undefined || ordering?.doctor_id !== own) throw notFound();
        if (o.status !== 'ordered')
          throw invalidState('A test can be cancelled only before the sample is collected.');
        await run(
          tx,
          sql`update lab_orders set status = 'cancelled', cancelled_by = ${actor.userId}, cancelled_at = now(), cancel_reason = ${reason} where id = ${id}`,
        );
        const billing = await cancelCharge(
          tx,
          { labOrderId: id },
          'lab_cancel',
          reason,
          actor.userId,
          meta,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'lab_order.cancelled',
          entityType: 'lab_order',
          entityId: id,
          patientId: o.patient_id,
          changes: { billing },
          reason,
        });
      });
      return labOrderById(db, id);
    },

    async worklist(status: string | undefined): Promise<LabOrder[]> {
      const ids = await many(
        db,
        sql`select id from lab_orders
             where (${status ?? null}::text is null and status not in ('verified', 'cancelled')) or status = ${status ?? null}
             order by priority desc, created_at limit 100`,
        z.object({ id: z.uuid() }),
      );
      const out: LabOrder[] = [];
      for (const { id } of ids) out.push(await labOrderById(db, id));
      return out;
    },

    get: (id: string) => labOrderById(db, id),

    async collect(actor: AuthContext, id: string, barcode: string, meta: RequestMeta) {
      try {
        return await transition(
          actor,
          id,
          ['ordered'],
          'sample_collected',
          sql`sample_barcode = ${barcode}, collected_by = ${actor.userId}, collected_at = now()`,
          'lab_order.sample_collected',
          meta,
        );
      } catch (error) {
        if (postgresErrorOf(error)?.code === PG.uniqueViolation)
          throw new AppError(409, 'CONFLICT', 'This barcode is already used for another sample.');
        throw error;
      }
    },

    rejectSample: (actor: AuthContext, id: string, reason: string, meta: RequestMeta) =>
      transition(
        actor,
        id,
        ['sample_collected'],
        'ordered',
        sql`sample_barcode = null, collected_by = null, collected_at = null`,
        'lab_order.sample_rejected',
        meta,
        reason,
      ),

    startProcessing: (actor: AuthContext, id: string, meta: RequestMeta) =>
      transition(
        actor,
        id,
        ['sample_collected'],
        'in_process',
        sql`updated_at = now()`,
        'lab_order.processing',
        meta,
      ),

    async enterResults(
      actor: AuthContext,
      id: string,
      results: readonly {
        parameterId: string;
        valueNum?: number | undefined;
        valueText?: string | undefined;
      }[],
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const o = await lockOrder(tx, id);
        if (o.status !== 'in_process')
          throw invalidState('Results are entered while the sample is being processed.');
        const parameters = await many(
          tx,
          sql`select id, unit, ref_low, ref_high from lab_test_parameters where test_id = ${o.test_id}`,
          z.object({
            id: z.uuid(),
            unit: z.string().nullable(),
            ref_low: nullableNum,
            ref_high: nullableNum,
          }),
        );
        if (results.some((r) => !parameters.some((p) => p.id === r.parameterId))) {
          throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
            { path: 'results', message: 'A parameter does not belong to this test' },
          ]);
        }
        if (parameters.some((p) => !results.some((r) => r.parameterId === p.id))) {
          throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
            { path: 'results', message: 'Enter every parameter of the test' },
          ]);
        }
        for (const r of results) {
          const p = parameters.find((x) => x.id === r.parameterId);
          if (!p) continue;
          await run(
            tx,
            sql`update lab_results set is_current = false where order_id = ${id} and parameter_id = ${r.parameterId} and is_current`,
          );
          await run(
            tx,
            sql`insert into lab_results (order_id, parameter_id, value_num, value_text, unit, ref_low, ref_high, abnormal_flag, entered_by)
                values (${id}, ${r.parameterId}, ${r.valueNum ?? null}, ${r.valueText ?? null}, ${p.unit}, ${p.ref_low}, ${p.ref_high},
                        ${flagOf(r.valueNum, p.ref_low, p.ref_high)}, ${actor.userId})`,
          );
        }
        await run(
          tx,
          sql`update lab_orders set status = 'resulted', resulted_by = ${actor.userId}, resulted_at = now() where id = ${id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'lab_result.entered',
          entityType: 'lab_order',
          entityId: id,
          patientId: o.patient_id,
        });
      });
      return labOrderById(db, id);
    },

    /** Verification by someone other than the person who entered the results (LB-3). */
    async verify(actor: AuthContext, id: string, meta: RequestMeta) {
      await transaction(db, async (tx) => {
        const o = await lockOrder(tx, id);
        if (o.status !== 'resulted') throw invalidState('Only entered results can be verified.');
        if (o.resulted_by === actor.userId)
          throw new AppError(
            403,
            'FORBIDDEN',
            'Results must be verified by someone other than the person who entered them.',
          );
        await run(
          tx,
          sql`update lab_orders set status = 'verified', verified_by = ${actor.userId}, verified_at = now() where id = ${id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'lab_result.verified',
          entityType: 'lab_order',
          entityId: id,
          patientId: o.patient_id,
        });
      });
      return labOrderById(db, id);
    },

    async rejectResults(actor: AuthContext, id: string, reason: string, meta: RequestMeta) {
      await transaction(db, async (tx) => {
        const o = await lockOrder(tx, id);
        if (o.status !== 'resulted') throw invalidState('Only entered results can be sent back.');
        if (o.resulted_by === actor.userId)
          throw new AppError(
            403,
            'FORBIDDEN',
            'Results must be reviewed by someone other than the person who entered them.',
          );
        await run(
          tx,
          sql`update lab_orders set status = 'in_process', resulted_by = null, resulted_at = null where id = ${id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'lab_result.rejected',
          entityType: 'lab_order',
          entityId: id,
          patientId: o.patient_id,
          reason,
        });
      });
      return labOrderById(db, id);
    },
  };
}

export type LabService = ReturnType<typeof createLabService>;
