import type { Doctor, LabTest, Medicine } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
import { dateText, many, maybeOne, one, run, transaction, type Db } from '../../db/sql';
import type { AuthContext, RequestMeta } from '../../http/context';
import { AppError } from '../../lib/errors';

const num = z.union([z.string(), z.number()]).transform(Number).pipe(z.number());
const nullableNum = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => (v === null ? null : Number(v)));
const notFound = () => new AppError(404, 'NOT_FOUND', 'Not found.');

const doctorRow = z.object({
  id: z.uuid(),
  full_name: z.string(),
  department_code: z.string(),
  department_name: z.string(),
  specialty: z.string(),
  consultation_fee_paise: num,
  default_slot_minutes: z.number(),
  active: z.boolean(),
});
const toDoctor = (r: z.infer<typeof doctorRow>): Doctor => ({
  id: r.id,
  fullName: r.full_name,
  departmentCode: r.department_code,
  departmentName: r.department_name,
  specialty: r.specialty,
  consultationFeePaise: r.consultation_fee_paise,
  defaultSlotMinutes: r.default_slot_minutes,
  active: r.active,
});
const DOCTOR_SELECT = sql`select dp.id, e.full_name, d.code as department_code, d.name as department_name,
    dp.specialty, dp.consultation_fee_paise, dp.default_slot_minutes, dp.active
  from doctor_profiles dp join employees e on e.id = dp.employee_id join departments d on d.id = dp.department_id`;

export function createReferenceService(db: Db) {
  return {
    async hospital() {
      return one(
        db,
        sql`select name, timezone, currency, (now() at time zone timezone)::date::text as today
              from hospital_settings where id = 1`,
        z.object({ name: z.string(), timezone: z.string(), currency: z.string(), today: dateText }),
      );
    },

    async departments() {
      const rows = await many(
        db,
        sql`select code, name, is_clinical from departments where active order by name`,
        z.object({ code: z.string(), name: z.string(), is_clinical: z.boolean() }),
      );
      return rows.map((r) => ({ code: r.code, name: r.name, isClinical: r.is_clinical }));
    },

    async doctors(departmentCode?: string): Promise<Doctor[]> {
      const rows = await many(
        db,
        sql`${DOCTOR_SELECT} where dp.active and (${departmentCode ?? null}::text is null or d.code = ${departmentCode ?? null})
            order by e.full_name`,
        doctorRow,
      );
      return rows.map(toDoctor);
    },

    async doctor(id: string): Promise<Doctor> {
      const row = await maybeOne(db, sql`${DOCTOR_SELECT} where dp.id = ${id}`, doctorRow);
      if (!row) throw notFound();
      return toDoctor(row);
    },

    async schedules(doctorId: string) {
      await this.doctor(doctorId);
      const rows = await many(
        db,
        sql`select id, weekday, to_char(start_time, 'HH24:MI') as start_time, to_char(end_time, 'HH24:MI') as end_time,
                   slot_minutes, valid_from::text as valid_from, valid_to::text as valid_to, active
              from doctor_schedules where doctor_id = ${doctorId} order by weekday, start_time`,
        z.object({
          id: z.uuid(),
          weekday: z.number(),
          start_time: z.string(),
          end_time: z.string(),
          slot_minutes: z.number(),
          valid_from: dateText,
          valid_to: dateText.nullable(),
          active: z.boolean(),
        }),
      );
      return rows.map((r) => ({
        id: r.id,
        weekday: r.weekday,
        startTime: r.start_time,
        endTime: r.end_time,
        slotMinutes: r.slot_minutes,
        validFrom: r.valid_from,
        validTo: r.valid_to,
        active: r.active,
      }));
    },

    async addSchedule(
      actor: AuthContext,
      doctorId: string,
      input: {
        weekday: number;
        startTime: string;
        endTime: string;
        slotMinutes: number;
        validFrom?: string | undefined;
        validTo?: string | undefined;
        reason: string;
      },
      meta: RequestMeta,
    ) {
      await this.doctor(doctorId);
      const created = await transaction(db, async (tx) => {
        // Overlapping hours on the same weekday would double the offered slots.
        const overlap = await maybeOne(
          tx,
          sql`select 1 as x from doctor_schedules
               where doctor_id = ${doctorId} and weekday = ${input.weekday} and active
                 and start_time < ${input.endTime}::time and end_time > ${input.startTime}::time`,
          z.object({ x: z.number() }),
        );
        if (overlap)
          throw new AppError(409, 'CONFLICT', 'These hours overlap existing hours on that day.');
        const row = await one(
          tx,
          sql`insert into doctor_schedules (doctor_id, weekday, start_time, end_time, slot_minutes, valid_from, valid_to, created_by, updated_by)
              values (${doctorId}, ${input.weekday}, ${input.startTime}::time, ${input.endTime}::time, ${input.slotMinutes},
                      coalesce(${input.validFrom ?? null}::date, current_date), ${input.validTo ?? null}::date, ${actor.userId}, ${actor.userId})
              returning id`,
          z.object({ id: z.uuid() }),
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'schedule.created',
          entityType: 'doctor_schedule',
          entityId: row.id,
          changes: {
            doctorId,
            weekday: input.weekday,
            startTime: input.startTime,
            endTime: input.endTime,
            slotMinutes: input.slotMinutes,
          },
          reason: input.reason,
        });
        return row.id;
      });
      return created;
    },

    async deactivateSchedule(
      actor: AuthContext,
      scheduleId: string,
      reason: string,
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const changed = await run(
          tx,
          sql`update doctor_schedules set active = false, updated_by = ${actor.userId} where id = ${scheduleId} and active`,
        );
        if (changed === 0) throw notFound();
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'schedule.deactivated',
          entityType: 'doctor_schedule',
          entityId: scheduleId,
          reason,
        });
      });
    },

    async updateFee(
      actor: AuthContext,
      doctorId: string,
      feePaise: number,
      reason: string,
      meta: RequestMeta,
    ): Promise<Doctor> {
      await transaction(db, async (tx) => {
        const before = await maybeOne(
          tx,
          sql`select consultation_fee_paise from doctor_profiles where id = ${doctorId} for update`,
          z.object({ consultation_fee_paise: num }),
        );
        if (!before) throw notFound();
        await run(
          tx,
          sql`update doctor_profiles set consultation_fee_paise = ${feePaise}, updated_by = ${actor.userId} where id = ${doctorId}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'fee.changed',
          entityType: 'doctor_profile',
          entityId: doctorId,
          changes: { fromPaise: before.consultation_fee_paise, toPaise: feePaise },
          reason,
        });
      });
      return this.doctor(doctorId);
    },

    async services() {
      const rows = await many(
        db,
        sql`select s.id, s.code, s.name, s.kind, s.price_paise, d.code as department_code, s.active
              from service_catalogue s left join departments d on d.id = s.department_id order by s.kind, s.name`,
        z.object({
          id: z.uuid(),
          code: z.string(),
          name: z.string(),
          kind: z.enum(['consultation', 'lab', 'procedure', 'other']),
          price_paise: num,
          department_code: z.string().nullable(),
          active: z.boolean(),
        }),
      );
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        kind: r.kind,
        pricePaise: r.price_paise,
        departmentCode: r.department_code,
        active: r.active,
      }));
    },

    async updatePrice(
      actor: AuthContext,
      serviceId: string,
      pricePaise: number,
      reason: string,
      meta: RequestMeta,
    ) {
      await transaction(db, async (tx) => {
        const before = await maybeOne(
          tx,
          sql`select price_paise from service_catalogue where id = ${serviceId} for update`,
          z.object({ price_paise: num }),
        );
        if (!before) throw notFound();
        await run(
          tx,
          sql`update service_catalogue set price_paise = ${pricePaise}, updated_by = ${actor.userId} where id = ${serviceId}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'price.changed',
          entityType: 'service',
          entityId: serviceId,
          changes: { fromPaise: before.price_paise, toPaise: pricePaise },
          reason,
        });
      });
    },

    /** Brand, generic (ingredient) or SKU search, with pharmacy availability right now. */
    async searchMedicines(q: string): Promise<Medicine[]> {
      const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const rows = await many(
        db,
        sql`select si.id, si.sku, mp.brand_name, mp.dosage_form, mp.route, mp.pack_size, si.base_unit, mp.rx_only,
                   coalesce((select json_agg(json_build_object('name', i.name::text, 'strength', pi.strength_value, 'unit', pi.strength_unit) order by i.name)
                               from product_ingredients pi join ingredients i on i.id = pi.ingredient_id
                              where pi.product_id = si.id), '[]'::json) as ingredients,
                   coalesce((select sum(b.qty_on_hand) from stock_batches b join locations l on l.id = b.location_id and l.kind = 'pharmacy'
                              where b.stock_item_id = si.id and b.status = 'active' and b.qty_on_hand > 0
                                and (b.expiry_date is null or b.expiry_date >= (now() at time zone 'Asia/Kolkata')::date)), 0)::int as available_qty,
                   (select min(b.expiry_date)::text from stock_batches b
                     where b.stock_item_id = si.id and b.status = 'active' and b.qty_on_hand > 0
                       and b.expiry_date >= (now() at time zone 'Asia/Kolkata')::date) as nearest_expiry
              from stock_items si join medicine_products mp on mp.stock_item_id = si.id
             where si.active and si.kind = 'medicine'
               and (mp.brand_name ilike ${pattern} or si.sku ilike ${pattern}
                    or exists (select 1 from product_ingredients pi join ingredients i on i.id = pi.ingredient_id
                                where pi.product_id = si.id and i.name ilike ${pattern}))
             order by mp.brand_name limit 20`,
        z.object({
          id: z.uuid(),
          sku: z.string(),
          brand_name: z.string(),
          dosage_form: z.string(),
          route: z.string(),
          pack_size: z.string().nullable(),
          base_unit: z.string(),
          rx_only: z.boolean(),
          ingredients: z.array(z.object({ name: z.string(), strength: num, unit: z.string() })),
          available_qty: z.number(),
          nearest_expiry: dateText.nullable(),
        }),
      );
      return rows.map((r) => ({
        stockItemId: r.id,
        sku: r.sku,
        brandName: r.brand_name,
        dosageForm: r.dosage_form,
        route: r.route,
        packSize: r.pack_size,
        baseUnit: r.base_unit,
        rxOnly: r.rx_only,
        ingredients: r.ingredients,
        availableQty: r.available_qty,
        nearestExpiry: r.nearest_expiry,
      }));
    },

    async labTests(): Promise<LabTest[]> {
      const rows = await many(
        db,
        sql`select t.id, t.code, t.name, t.sample_type, t.turnaround_hours, s.price_paise,
                   coalesce((select json_agg(json_build_object('id', p.id, 'name', p.name, 'unit', p.unit, 'refLow', p.ref_low,
                                                               'refHigh', p.ref_high, 'refText', p.ref_text) order by p.sort_order)
                               from lab_test_parameters p where p.test_id = t.id), '[]'::json) as parameters
              from lab_tests t join service_catalogue s on s.id = t.service_id
             where t.active order by t.name`,
        z.object({
          id: z.uuid(),
          code: z.string(),
          name: z.string(),
          sample_type: z.string(),
          turnaround_hours: z.number(),
          price_paise: num,
          parameters: z.array(
            z.object({
              id: z.uuid(),
              name: z.string(),
              unit: z.string().nullable(),
              refLow: nullableNum,
              refHigh: nullableNum,
              refText: z.string().nullable(),
            }),
          ),
        }),
      );
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        sampleType: r.sample_type,
        turnaroundHours: r.turnaround_hours,
        pricePaise: r.price_paise,
        parameters: r.parameters,
      }));
    },
  };
}

export type ReferenceService = ReturnType<typeof createReferenceService>;
