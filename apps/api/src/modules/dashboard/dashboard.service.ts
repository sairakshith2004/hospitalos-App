import type { Dashboard } from '@hospitalos/contracts';
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import { dateText, one, type Db } from '../../db/sql';
import type { AuthContext } from '../../http/context';
import { doctorIdOf, TODAY } from '../shared/access';

/**
 * Role dashboards (phase 1.11, DB-1): every figure is a database query run by the server; nothing
 * is invented, cached on the phone or estimated. Roles whose modules arrive later get no figures.
 */
type Metric = Dashboard['metrics'][number];
const count = z.object({ n: z.union([z.string(), z.number()]).transform(Number) });

export function createDashboardService(db: Db) {
  const value = async (query: SQL) => (await one(db, query, count)).n;
  const metric = (
    key: string,
    label: string,
    v: number,
    unit: 'count' | 'paise' = 'count',
    hint: string | null = null,
  ): Metric => ({ key, label, value: v, unit, hint });

  return {
    async forUser(actor: AuthContext): Promise<Dashboard> {
      const date = (await one(db, sql`select ${TODAY}::text as d`, z.object({ d: dateText }))).d;
      const roles = actor.roles;
      const metrics: Metric[] = [];
      const tasks: Dashboard['tasks'] = [];
      const has = (role: string) => roles.some((r) => r === role);

      if (has('REC') || has('ADM') || has('SA')) {
        metrics.push(
          metric(
            'appointments_today',
            "Today's appointments",
            await value(
              sql`select count(*) as n from appointments where visit_date = ${TODAY} and status <> 'rescheduled'`,
            ),
          ),
          metric(
            'arrived_today',
            'Arrived',
            await value(
              sql`select count(*) as n from appointments where visit_date = ${TODAY} and checked_in_at is not null`,
            ),
          ),
          metric(
            'waiting_now',
            'Waiting now',
            await value(
              sql`select count(*) as n from appointments where visit_date = ${TODAY} and status = 'checked_in'`,
            ),
          ),
          metric(
            'new_patients_today',
            'New registrations',
            await value(
              sql`select count(*) as n from patients where (created_at at time zone 'Asia/Kolkata')::date = ${TODAY}`,
            ),
          ),
        );
        tasks.push({
          key: 'follow_ups_due',
          title: 'Follow-ups due or overdue',
          count: await value(
            sql`select count(*) as n from follow_ups where status = 'pending' and due_from <= ${TODAY}`,
          ),
        });
      }
      if (has('DOC')) {
        const doctorId = (await doctorIdOf(db, actor.userId)) ?? null;
        metrics.push(
          metric(
            'my_appointments_today',
            'My appointments today',
            await value(
              sql`select count(*) as n from appointments where doctor_id = ${doctorId} and visit_date = ${TODAY} and status not in ('cancelled', 'rescheduled')`,
            ),
          ),
          metric(
            'my_queue',
            'In my queue',
            await value(
              sql`select count(*) as n from appointments where doctor_id = ${doctorId} and visit_date = ${TODAY} and status = 'checked_in'`,
            ),
          ),
          metric(
            'my_open_encounters',
            'Consultations in progress',
            await value(
              sql`select count(*) as n from encounters where doctor_id = ${doctorId} and status = 'in_progress'`,
            ),
          ),
        );
        tasks.push({
          key: 'my_follow_ups',
          title: 'My follow-ups waiting to be booked',
          count: await value(
            sql`select count(*) as n from follow_ups where target_doctor_id = ${doctorId} and status = 'pending'`,
          ),
        });
      }
      if (has('NUR')) {
        metrics.push(
          metric(
            'my_sessions_today',
            'My sessions today',
            await value(
              sql`select count(*) as n from nurse_assignments where nurse_user_id = ${actor.userId} and session_date = ${TODAY} and revoked_at is null`,
            ),
          ),
          metric(
            'my_patients_waiting',
            'Checked-in patients in my sessions',
            await value(
              sql`select count(*) as n from appointments a join nurse_assignments na on na.doctor_id = a.doctor_id and na.session_date = a.visit_date and na.nurse_user_id = ${actor.userId} and na.revoked_at is null where a.visit_date = ${TODAY} and a.status in ('checked_in', 'in_consultation') and (a.doctor_schedule_id is null or a.doctor_schedule_id = na.doctor_schedule_id)`,
            ),
          ),
        );
      }
      if (has('PHA') || has('INV')) {
        metrics.push(
          metric(
            'rx_waiting',
            'Prescriptions to dispense',
            await value(
              sql`select count(*) as n from prescriptions where status in ('issued', 'partially_dispensed') and valid_until >= ${TODAY}`,
            ),
          ),
          metric(
            'dispensed_today',
            'Dispensed today',
            await value(
              sql`select count(*) as n from dispensings where (dispensed_at at time zone 'Asia/Kolkata')::date = ${TODAY}`,
            ),
          ),
          metric(
            'low_stock_items',
            'Medicines at or below reorder level',
            await value(
              sql`select count(*) as n from stock_items si where si.kind = 'medicine' and si.active and coalesce((select sum(qty_on_hand) from stock_batches b where b.stock_item_id = si.id and b.status = 'active' and (b.expiry_date is null or b.expiry_date >= ${TODAY})), 0) <= si.reorder_level`,
            ),
          ),
          metric(
            'expiring_batches',
            'Batches expiring within the alert window',
            await value(
              sql`select count(*) as n from stock_batches b, hospital_settings s where s.id = 1 and b.status = 'active' and b.qty_on_hand > 0 and b.expiry_date between ${TODAY} and ${TODAY} + s.near_expiry_days`,
            ),
          ),
        );
      }
      if (has('LAB')) {
        metrics.push(
          metric(
            'samples_pending',
            'Samples to collect',
            await value(sql`select count(*) as n from lab_orders where status = 'ordered'`),
          ),
          metric(
            'tests_in_process',
            'Tests in process',
            await value(
              sql`select count(*) as n from lab_orders where status in ('sample_collected', 'in_process')`,
            ),
          ),
          metric(
            'awaiting_verification',
            'Results awaiting verification',
            await value(sql`select count(*) as n from lab_orders where status = 'resulted'`),
          ),
        );
      }
      if (has('FIN') || has('ADM') || has('SA')) {
        metrics.push(
          metric(
            'draft_invoices',
            'Draft invoices',
            await value(sql`select count(*) as n from invoices where status = 'draft'`),
          ),
          metric(
            'collected_today',
            'Collected today',
            await value(
              sql`select coalesce(sum(amount_paise), 0) as n from payments where (received_at at time zone 'Asia/Kolkata')::date = ${TODAY}`,
            ),
            'paise',
          ),
          metric(
            'outstanding',
            'Outstanding on issued invoices',
            await value(
              sql`select coalesce(sum(total_paise - paid_paise), 0) as n from invoices where status in ('issued', 'partially_paid')`,
            ),
            'paise',
          ),
        );
        tasks.push({
          key: 'open_corrections',
          title: 'Billing corrections waiting for Finance',
          count: await value(
            sql`select count(*) as n from billing_corrections where status = 'open'`,
          ),
        });
      }
      if (has('SA')) {
        metrics.push(
          metric(
            'active_staff',
            'Active staff accounts',
            await value(
              sql`select count(*) as n from users where status = 'active' and not is_demo`,
            ),
          ),
          metric(
            'audit_events_today',
            'Audit events today',
            await value(
              sql`select count(*) as n from audit_logs where (occurred_at at time zone 'Asia/Kolkata')::date = ${TODAY}`,
            ),
          ),
        );
      }
      if (has('HR') && !has('SA')) {
        metrics.push(
          metric(
            'active_staff',
            'Active staff accounts',
            await value(
              sql`select count(*) as n from users where status = 'active' and not is_demo`,
            ),
          ),
        );
      }
      // Keep one entry per key (a user with several roles would otherwise see duplicates).
      const unique = metrics.filter(
        (m, index) => metrics.findIndex((x) => x.key === m.key) === index,
      );
      return { date, role: roles.join(',') || 'none', metrics: unique, tasks };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
