import type { Prescription } from '@hospitalos/contracts';
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
import { addCharge } from '../billing/billing.core';
import { ownEncounter } from '../clinical/clinical.service';
import { doctorIdOf, notFound, TODAY } from '../shared/access';
import { idempotent } from '../shared/idempotency';

const invalidState = (message: string) => new AppError(422, 'INVALID_STATE', message);
const int = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int());

export async function prescriptionById(db: Executor, id: string): Promise<Prescription> {
  const rx = await maybeOne(
    db,
    sql`select r.id, r.rx_no, r.status, r.issued_at, r.valid_until::text as valid_until, r.valid_until < ${TODAY} as expired,
               p.id as patient_id, p.mrn, p.first_name || ' ' || p.last_name as patient_name, e.full_name as doctor_name
          from prescriptions r join patients p on p.id = r.patient_id
          join doctor_profiles dp on dp.id = r.doctor_id join employees e on e.id = dp.employee_id
         where r.id = ${id}`,
    z.object({
      id: z.uuid(),
      rx_no: z.string(),
      status: z.enum(['issued', 'partially_dispensed', 'dispensed', 'cancelled', 'closed']),
      issued_at: timestamptz,
      valid_until: dateText,
      expired: z.boolean(),
      patient_id: z.uuid(),
      mrn: z.string(),
      patient_name: z.string(),
      doctor_name: z.string(),
    }),
  );
  if (!rx) throw notFound();
  const items = await many(
    db,
    sql`select i.id, i.stock_item_id, mp.brand_name, i.dose, i.frequency, i.route, i.duration_days, i.qty_prescribed, i.qty_dispensed,
               i.substitution_allowed, i.allergy_acknowledged, i.instructions
          from prescription_items i join medicine_products mp on mp.stock_item_id = i.stock_item_id
         where i.prescription_id = ${id} order by mp.brand_name`,
    z.object({
      id: z.uuid(),
      stock_item_id: z.uuid(),
      brand_name: z.string(),
      dose: z.string(),
      frequency: z.string(),
      route: z.string(),
      duration_days: z.number().nullable(),
      qty_prescribed: z.number(),
      qty_dispensed: z.number(),
      substitution_allowed: z.boolean(),
      allergy_acknowledged: z.boolean(),
      instructions: z.string().nullable(),
    }),
  );
  const allergies = await many(
    db,
    sql`select substance, severity from allergies where patient_id = ${rx.patient_id} and status = 'active' order by substance`,
    z.object({ substance: z.string(), severity: z.string() }),
  );
  return {
    id: rx.id,
    rxNo: rx.rx_no,
    status: rx.status,
    issuedAt: rx.issued_at,
    validUntil: rx.valid_until,
    expired: rx.expired,
    patient: { id: rx.patient_id, mrn: rx.mrn, name: rx.patient_name },
    doctorName: rx.doctor_name,
    allergies,
    items: items.map((i) => ({
      id: i.id,
      stockItemId: i.stock_item_id,
      medicineName: i.brand_name,
      dose: i.dose,
      frequency: i.frequency,
      route: i.route,
      durationDays: i.duration_days,
      qtyPrescribed: i.qty_prescribed,
      qtyDispensed: i.qty_dispensed,
      substitutionAllowed: i.substitution_allowed,
      allergyAcknowledged: i.allergy_acknowledged,
      instructions: i.instructions,
    })),
  };
}

type ItemInput = Readonly<{
  stockItemId: string;
  dose: string;
  frequency: string;
  route: 'oral' | 'topical' | 'iv' | 'im' | 'sc' | 'inhalation' | 'ophthalmic' | 'otic' | 'nasal';
  durationDays?: number | undefined;
  qtyPrescribed: number;
  substitutionAllowed: boolean;
  instructions?: string | undefined;
}>;

/** Ingredient set of a product as "name:strength:unit" strings, for substitution checks. */
async function ingredientKey(tx: Executor, stockItemId: string): Promise<string> {
  const rows = await many(
    tx,
    sql`select lower(i.name) || ':' || pi.strength_value::text || ':' || pi.strength_unit as k
          from product_ingredients pi join ingredients i on i.id = pi.ingredient_id
         where pi.product_id = ${stockItemId} order by 1`,
    z.object({ k: z.string() }),
  );
  return rows.map((r) => r.k).join('|');
}

export function createPharmacyService(db: Db) {
  return {
    /**
     * A doctor prescribes during their own consultation (RX-4). An item matching a recorded allergy
     * (by ingredient) needs the doctor's acknowledgement; nothing is ever recommended or suggested.
     */
    async create(
      actor: AuthContext,
      encounterId: string,
      input: {
        items: readonly ItemInput[];
        notes?: string | undefined;
        allergyAcknowledged: boolean;
      },
      meta: RequestMeta,
    ) {
      const id = await transaction(db, async (tx) => {
        const e = await ownEncounter(tx, actor, encounterId);
        if (e.status !== 'in_progress')
          throw invalidState('Prescriptions are written during the consultation.');
        const matches: string[] = [];
        for (const item of input.items) {
          const product = await maybeOne(
            tx,
            sql`select mp.brand_name from medicine_products mp join stock_items si on si.id = mp.stock_item_id
                 where mp.stock_item_id = ${item.stockItemId} and si.active`,
            z.object({ brand_name: z.string() }),
          );
          if (!product) {
            throw new AppError(422, 'VALIDATION_FAILED', 'Some fields are not valid.', [
              { path: 'items', message: 'Unknown medicine' },
            ]);
          }
          const allergy = await maybeOne(
            tx,
            sql`select a.substance from allergies a
                 where a.patient_id = ${e.patient_id} and a.status = 'active'
                   and exists (select 1 from product_ingredients pi join ingredients i on i.id = pi.ingredient_id
                                where pi.product_id = ${item.stockItemId}
                                  and (pi.ingredient_id = a.ingredient_id or lower(i.name) = lower(a.substance)))
                 limit 1`,
            z.object({ substance: z.string() }),
          );
          if (allergy) matches.push(`${product.brand_name} (allergy: ${allergy.substance})`);
        }
        if (matches.length > 0 && !input.allergyAcknowledged) {
          throw new AppError(
            422,
            'UNPROCESSABLE',
            'This prescription matches a recorded allergy. Review it and confirm to continue.',
            [{ path: 'allergyAcknowledged', message: matches.join('; ') }],
          );
        }
        const rx = await one(
          tx,
          sql`insert into prescriptions (encounter_id, patient_id, doctor_id, valid_until, notes, created_by, updated_by)
              select ${encounterId}, ${e.patient_id}, ${e.doctorId}, ${TODAY} + s.prescription_validity_days, ${input.notes ?? null},
                     ${actor.userId}, ${actor.userId}
                from hospital_settings s where s.id = 1
              returning id`,
          z.object({ id: z.uuid() }),
        );
        for (const item of input.items) {
          await run(
            tx,
            sql`insert into prescription_items (prescription_id, stock_item_id, dose, frequency, route, duration_days, qty_prescribed,
                                                substitution_allowed, allergy_acknowledged, instructions)
                values (${rx.id}, ${item.stockItemId}, ${item.dose}, ${item.frequency}, ${item.route}, ${item.durationDays ?? null},
                        ${item.qtyPrescribed}, ${item.substitutionAllowed}, ${matches.length > 0}, ${item.instructions ?? null})`,
          );
        }
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'prescription.issued',
          entityType: 'prescription',
          entityId: rx.id,
          patientId: e.patient_id,
          changes: { items: input.items.length, allergyAcknowledged: matches.length > 0 },
        });
        return rx.id;
      });
      return prescriptionById(db, id);
    },

    async get(actor: AuthContext, id: string): Promise<Prescription> {
      const rx = await prescriptionById(db, id);
      if (!actor.permissions.has('prescription:dispense') && !actor.roles.includes('SA')) {
        const own = await doctorIdOf(db, actor.userId);
        const owner = await maybeOne(
          db,
          sql`select doctor_id from prescriptions where id = ${id}`,
          z.object({ doctor_id: z.uuid() }),
        );
        if (own === undefined || owner?.doctor_id !== own) throw notFound();
      }
      return rx;
    },

    async queue(): Promise<Prescription[]> {
      const ids = await many(
        db,
        sql`select id from prescriptions where status in ('issued', 'partially_dispensed') order by issued_at limit 100`,
        z.object({ id: z.uuid() }),
      );
      const out: Prescription[] = [];
      for (const { id } of ids) out.push(await prescriptionById(db, id));
      return out;
    },

    /** An issued prescription is never edited: it is cancelled (only if nothing was dispensed). */
    async cancel(actor: AuthContext, id: string, reason: string, meta: RequestMeta) {
      await transaction(db, async (tx) => {
        const own = await doctorIdOf(tx, actor.userId);
        const rx = await maybeOne(
          tx,
          sql`select status, doctor_id, patient_id from prescriptions where id = ${id} for update`,
          z.object({ status: z.string(), doctor_id: z.uuid(), patient_id: z.uuid() }),
        );
        if (!rx || own === undefined || rx.doctor_id !== own) throw notFound();
        if (rx.status !== 'issued')
          throw invalidState('Only a prescription with nothing dispensed can be cancelled.');
        await run(
          tx,
          sql`update prescriptions set status = 'cancelled', cancel_reason = ${reason}, version = version + 1, updated_by = ${actor.userId} where id = ${id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'prescription.cancelled',
          entityType: 'prescription',
          entityId: id,
          patientId: rx.patient_id,
          reason,
        });
      });
      return prescriptionById(db, id);
    },

    async close(actor: AuthContext, id: string, reason: string, meta: RequestMeta) {
      await transaction(db, async (tx) => {
        const rx = await maybeOne(
          tx,
          sql`select status, patient_id from prescriptions where id = ${id} for update`,
          z.object({ status: z.string(), patient_id: z.uuid() }),
        );
        if (!rx) throw notFound();
        if (rx.status !== 'partially_dispensed')
          throw invalidState('Only a partly dispensed prescription can be closed.');
        await run(
          tx,
          sql`update prescriptions set status = 'closed', close_reason = ${reason}, version = version + 1, updated_by = ${actor.userId} where id = ${id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'prescription.closed',
          entityType: 'prescription',
          entityId: id,
          patientId: rx.patient_id,
          reason,
        });
      });
      return prescriptionById(db, id);
    },

    /**
     * Dispensing (DP-1 to DP-4, DP-7, DP-10, EX-*): one atomic transaction. Batches are chosen
     * first-expiry-first-out from the pharmacy; expired, recalled and quarantined stock is never
     * used; near-expiry stock needs an acknowledgement. Stock, prescription and the visit's draft
     * invoice change together, or nothing changes. A retry with the same Idempotency-Key returns the
     * first result (DP-3).
     */
    async dispense(
      actor: AuthContext,
      prescriptionId: string,
      lines: readonly {
        prescriptionItemId: string;
        qty: number;
        substituteStockItemId?: string | undefined;
        acknowledgeNearExpiry: boolean;
      }[],
      key: string,
      meta: RequestMeta,
    ) {
      return idempotent(
        db,
        actor.userId,
        key,
        'prescription.dispense',
        { prescriptionId, lines },
        async (tx) => {
          const rx = await maybeOne(
            tx,
            sql`select r.id, r.status, r.patient_id, r.valid_until < ${TODAY} as expired, e.appointment_id
                from prescriptions r join encounters e on e.id = r.encounter_id where r.id = ${prescriptionId} for update of r`,
            z.object({
              id: z.uuid(),
              status: z.string(),
              patient_id: z.uuid(),
              expired: z.boolean(),
              appointment_id: z.uuid(),
            }),
          );
          if (!rx) throw notFound();
          if (rx.status !== 'issued' && rx.status !== 'partially_dispensed')
            throw invalidState(`This prescription is ${rx.status.replace('_', ' ')}.`);
          if (rx.expired)
            throw new AppError(
              422,
              'PRESCRIPTION_EXPIRED',
              'This prescription has passed its validity date. Ask the doctor for a new one.',
            );
          const settings = await one(
            tx,
            sql`select near_expiry_days from hospital_settings where id = 1`,
            z.object({ near_expiry_days: z.number() }),
          );
          const pharmacy = await one(
            tx,
            sql`select id from locations where kind = 'pharmacy' and active order by code limit 1`,
            z.object({ id: z.uuid() }),
          );
          const dispensing = await one(
            tx,
            sql`insert into dispensings (prescription_id, patient_id, location_id, dispensed_by) values (${prescriptionId}, ${rx.patient_id}, ${pharmacy.id}, ${actor.userId}) returning id, dispense_no`,
            z.object({ id: z.uuid(), dispense_no: z.string() }),
          );
          const out: {
            prescriptionItemId: string;
            batchNo: string;
            expiryDate: string | null;
            qty: number;
            unitPricePaise: number;
          }[] = [];

          for (const line of lines) {
            const item = await maybeOne(
              tx,
              sql`select id, stock_item_id, qty_prescribed - qty_dispensed as remaining, substitution_allowed
                  from prescription_items where id = ${line.prescriptionItemId} and prescription_id = ${prescriptionId} for update`,
              z.object({
                id: z.uuid(),
                stock_item_id: z.uuid(),
                remaining: z.number(),
                substitution_allowed: z.boolean(),
              }),
            );
            if (!item) throw notFound();
            if (line.qty > item.remaining)
              throw invalidState(`Only ${item.remaining} remain to be dispensed for this item.`);
            let product = item.stock_item_id;
            const substituted =
              line.substituteStockItemId !== undefined &&
              line.substituteStockItemId !== item.stock_item_id;
            if (substituted && line.substituteStockItemId !== undefined) {
              if (!item.substitution_allowed)
                throw invalidState('The doctor did not allow substitution for this item.');
              if (!actor.permissions.has('dispense:substitute'))
                throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
              if (
                (await ingredientKey(tx, line.substituteStockItemId)) !==
                (await ingredientKey(tx, item.stock_item_id))
              ) {
                throw invalidState('A substitute must have the same ingredients and strengths.');
              }
              product = line.substituteStockItemId;
            }
            // Lock every candidate batch in ascending id (global lock order), then allocate by expiry.
            const batches = await many(
              tx,
              sql`select id, batch_no, expiry_date::text as expiry_date, qty_on_hand, sale_price_paise,
                       expiry_date <= ${TODAY} + ${settings.near_expiry_days}::int as near_expiry
                  from stock_batches
                 where stock_item_id = ${product} and location_id = ${pharmacy.id} and status = 'active' and qty_on_hand > 0
                   and (expiry_date is null or expiry_date >= ${TODAY})
                 order by id for update`,
              z.object({
                id: z.uuid(),
                batch_no: z.string(),
                expiry_date: dateText.nullable(),
                qty_on_hand: z.number(),
                sale_price_paise: int,
                near_expiry: z.boolean().nullable(),
              }),
            );
            batches.sort(
              (a, b) =>
                (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999') ||
                a.id.localeCompare(b.id),
            );
            const available = batches.reduce((sum, b) => sum + b.qty_on_hand, 0);
            if (available < line.qty) {
              throw new AppError(
                422,
                'INSUFFICIENT_STOCK',
                `Not enough dispensable stock: ${available} available.`,
              );
            }
            let needed = line.qty;
            for (const batch of batches) {
              if (needed === 0) break;
              const take = Math.min(needed, batch.qty_on_hand);
              if (batch.near_expiry === true && !line.acknowledgeNearExpiry) {
                throw new AppError(
                  422,
                  'UNPROCESSABLE',
                  `Batch ${batch.batch_no} expires on ${batch.expiry_date ?? ''}. Confirm near-expiry stock to continue.`,
                  [
                    {
                      path: 'acknowledgeNearExpiry',
                      message: `Batch ${batch.batch_no} is near expiry`,
                    },
                  ],
                );
              }
              const balance = batch.qty_on_hand - take;
              await run(
                tx,
                sql`update stock_batches set qty_on_hand = ${balance} where id = ${batch.id}`,
              );
              const movement = await one(
                tx,
                sql`insert into stock_movements (batch_id, kind, qty, balance_after, ref_type, ref_id, performed_by)
                  values (${batch.id}, 'dispense', ${-take}, ${balance}, 'dispensing', ${dispensing.id}, ${actor.userId}) returning id`,
                z.object({ id: z.union([z.string(), z.number()]).transform(String) }),
              );
              const dl = await one(
                tx,
                sql`insert into dispensing_lines (dispensing_id, prescription_item_id, batch_id, stock_item_id, qty, unit_price_paise, substituted,
                                                near_expiry_acknowledged, stock_movement_id)
                  values (${dispensing.id}, ${item.id}, ${batch.id}, ${product}, ${take}, ${batch.sale_price_paise}, ${substituted},
                          ${batch.near_expiry === true}, ${movement.id}::bigint)
                  returning id`,
                z.object({ id: z.uuid() }),
              );
              const name = await one(
                tx,
                sql`select brand_name from medicine_products where stock_item_id = ${product}`,
                z.object({ brand_name: z.string() }),
              );
              await addCharge(
                tx,
                rx.appointment_id,
                {
                  description: `${name.brand_name} (batch ${batch.batch_no})`,
                  sourceType: 'dispensing',
                  dispensingLineId: dl.id,
                  qty: take,
                  unitPricePaise: batch.sale_price_paise,
                },
                actor.userId,
              );
              out.push({
                prescriptionItemId: item.id,
                batchNo: batch.batch_no,
                expiryDate: batch.expiry_date,
                qty: take,
                unitPricePaise: batch.sale_price_paise,
              });
              needed -= take;
            }
            await run(
              tx,
              sql`update prescription_items set qty_dispensed = qty_dispensed + ${line.qty} where id = ${item.id}`,
            );
          }

          const remaining = await one(
            tx,
            sql`select coalesce(sum(qty_prescribed - qty_dispensed), 0)::int as n from prescription_items where prescription_id = ${prescriptionId}`,
            z.object({ n: z.number() }),
          );
          const status = remaining.n === 0 ? 'dispensed' : 'partially_dispensed';
          await run(
            tx,
            sql`update prescriptions set status = ${status}, version = version + 1, updated_by = ${actor.userId} where id = ${prescriptionId}`,
          );
          await writeAudit(tx, userActor(actor.userId), meta, {
            action: 'prescription.dispensed',
            entityType: 'dispensing',
            entityId: dispensing.id,
            patientId: rx.patient_id,
            changes: { lines: out.length, status },
          });
          return {
            status: 201,
            body: {
              id: dispensing.id,
              dispenseNo: dispensing.dispense_no,
              prescriptionStatus: status,
              lines: out,
            },
          };
        },
      );
    },
  };
}

export type PharmacyService = ReturnType<typeof createPharmacyService>;
