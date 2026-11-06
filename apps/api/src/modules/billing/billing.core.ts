import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
import { maybeOne, one, run, type Executor } from '../../db/sql';
import type { RequestMeta } from '../../http/context';

/**
 * Charges flow into the visit's draft invoice from the department that performs the service
 * (workflows §5): consultation at check-in, lab at order, medicines at dispensing. All functions
 * take an open transaction, so the charge commits with the clinical action or not at all.
 */
const num = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int());
const id = z.object({ id: z.uuid() });

/** Indian fiscal year (April–March) of the hospital-local date. */
export async function fiscalYear(tx: Executor): Promise<number> {
  const row = await one(
    tx,
    sql`select extract(year from d)::int - case when extract(month from d) < 4 then 1 else 0 end as fy
          from (select (now() at time zone 'Asia/Kolkata')::date as d) t`,
    z.object({ fy: z.number() }),
  );
  return row.fy;
}

/** Gapless numbers per fiscal year: the counter row is locked until the transaction ends. */
export async function nextDocumentNumber(
  tx: Executor,
  docType: 'invoice' | 'receipt',
): Promise<string> {
  const fy = await fiscalYear(tx);
  await run(
    tx,
    sql`insert into document_counters (doc_type, fiscal_year) values (${docType}, ${fy}) on conflict do nothing`,
  );
  const row = await one(
    tx,
    sql`update document_counters set next_value = next_value + 1
         where doc_type = ${docType} and fiscal_year = ${fy}
         returning next_value - 1 as value`,
    z.object({ value: z.number() }),
  );
  const prefix = docType === 'invoice' ? 'INV' : 'RCP';
  return `${prefix}/${fy}-${String((fy + 1) % 100).padStart(2, '0')}/${String(row.value).padStart(6, '0')}`;
}

/** The visit's draft invoice, created on the first charge. */
export async function draftInvoiceFor(
  tx: Executor,
  appointmentId: string,
  actorId: string,
): Promise<string> {
  await run(
    tx,
    sql`insert into invoices (patient_id, appointment_id, created_by)
        select patient_id, id, ${actorId} from appointments where id = ${appointmentId}
        on conflict (appointment_id) where status = 'draft' do nothing`,
  );
  return (
    await one(
      tx,
      sql`select id from invoices where appointment_id = ${appointmentId} and status = 'draft' for update`,
      id,
    )
  ).id;
}

export async function recalculateDraft(tx: Executor, invoiceId: string): Promise<void> {
  await run(
    tx,
    sql`update invoices i
           set subtotal_paise = t.sum, total_paise = t.sum - i.discount_paise + i.tax_paise, version = i.version + 1
          from (select coalesce(sum(line_total_paise), 0) as sum from invoice_items where invoice_id = ${invoiceId} and is_active) t
         where i.id = ${invoiceId} and i.status = 'draft'`,
  );
}

export type Charge = Readonly<{
  description: string;
  sourceType: 'consultation' | 'dispensing' | 'lab';
  serviceId?: string | null;
  consultationAppointmentId?: string | null;
  dispensingLineId?: string | null;
  labOrderId?: string | null;
  qty: number;
  unitPricePaise: number;
}>;

export async function addCharge(
  tx: Executor,
  appointmentId: string,
  charge: Charge,
  actorId: string,
): Promise<string> {
  const invoiceId = await draftInvoiceFor(tx, appointmentId, actorId);
  await run(
    tx,
    sql`insert into invoice_items (invoice_id, service_id, description, source_type, consultation_appointment_id,
                                   dispensing_line_id, lab_order_id, qty, unit_price_paise, line_total_paise, created_by)
        values (${invoiceId}, ${charge.serviceId ?? null}, ${charge.description}, ${charge.sourceType},
                ${charge.consultationAppointmentId ?? null}, ${charge.dispensingLineId ?? null}, ${charge.labOrderId ?? null},
                ${charge.qty}, ${charge.unitPricePaise}, ${charge.qty * charge.unitPricePaise}, ${actorId})`,
  );
  await recalculateDraft(tx, invoiceId);
  return invoiceId;
}

/**
 * A service was cancelled (workflows §4.1): on a draft invoice its line is deactivated and the
 * draft recalculated; on an issued invoice nothing changes and a billing correction is opened for
 * Finance, which blocks collecting that amount.
 */
export async function cancelCharge(
  tx: Executor,
  where: Readonly<{ consultationAppointmentId: string } | { labOrderId: string }>,
  origin: 'appointment_cancel' | 'lab_cancel',
  reason: string,
  actorId: string,
  meta: RequestMeta,
): Promise<'none' | 'deactivated' | 'correction_opened'> {
  const filter =
    'consultationAppointmentId' in where
      ? sql`ii.consultation_appointment_id = ${where.consultationAppointmentId}`
      : sql`ii.lab_order_id = ${where.labOrderId}`;
  const line = await maybeOne(
    tx,
    sql`select ii.id, ii.invoice_id, ii.line_total_paise, i.status, i.paid_paise, i.patient_id
          from invoice_items ii join invoices i on i.id = ii.invoice_id
         where ${filter} and ii.is_active
         for update of i`,
    z.object({
      id: z.uuid(),
      invoice_id: z.uuid(),
      line_total_paise: num,
      status: z.string(),
      paid_paise: num,
      patient_id: z.uuid(),
    }),
  );
  if (!line) return 'none';
  if (line.status === 'draft') {
    await run(
      tx,
      sql`update invoice_items set is_active = false, deactivated_at = now(), deactivated_by = ${actorId},
                 deactivation_reason = ${reason} where id = ${line.id}`,
    );
    await recalculateDraft(tx, line.invoice_id);
    await writeAudit(tx, userActor(actorId), meta, {
      action: 'invoice_item.deactivated',
      entityType: 'invoice_item',
      entityId: line.id,
      patientId: line.patient_id,
      changes: { amountPaise: line.line_total_paise, origin },
      reason,
    });
    return 'deactivated';
  }
  const correction = await maybeOne(
    tx,
    sql`insert into billing_corrections (invoice_id, invoice_item_id, amount_paise, origin, reason, initiated_by, refund_may_be_due)
        values (${line.invoice_id}, ${line.id}, ${line.line_total_paise}, ${origin}, ${reason}, ${actorId}, ${line.paid_paise > 0})
        on conflict (invoice_item_id) where status = 'open' do nothing
        returning id`,
    id,
  );
  await writeAudit(tx, userActor(actorId), meta, {
    action: 'billing_correction.opened',
    entityType: 'billing_correction',
    entityId: correction?.id ?? null,
    patientId: line.patient_id,
    changes: {
      invoiceId: line.invoice_id,
      amountPaise: line.line_total_paise,
      origin,
      refundMayBeDue: line.paid_paise > 0,
    },
    reason,
  });
  return 'correction_opened';
}
