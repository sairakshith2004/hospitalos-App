import type { Invoice } from '@hospitalos/contracts';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { userActor, writeAudit } from '../../audit';
import {
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
import { notFound } from '../shared/access';
import { idempotent } from '../shared/idempotency';

import { nextDocumentNumber } from './billing.core';

const paise = z.union([z.string(), z.number()]).transform(Number).pipe(z.number().int());

export async function invoiceById(db: Executor, id: string): Promise<Invoice> {
  const i = await maybeOne(
    db,
    sql`select i.id, i.invoice_no, i.status, i.appointment_id, i.subtotal_paise, i.discount_paise, i.tax_paise, i.total_paise, i.paid_paise,
               i.issued_at, p.id as patient_id, p.mrn, p.first_name || ' ' || p.last_name as patient_name,
               coalesce((select sum(amount_paise) from billing_corrections c where c.invoice_id = i.id and c.status = 'open'), 0) as pending
          from invoices i join patients p on p.id = i.patient_id where i.id = ${id}`,
    z.object({
      id: z.uuid(),
      invoice_no: z.string().nullable(),
      status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'void']),
      appointment_id: z.uuid(),
      subtotal_paise: paise,
      discount_paise: paise,
      tax_paise: paise,
      total_paise: paise,
      paid_paise: paise,
      issued_at: nullableTimestamptz,
      patient_id: z.uuid(),
      mrn: z.string(),
      patient_name: z.string(),
      pending: paise,
    }),
  );
  if (!i) throw notFound();
  const lines = await many(
    db,
    sql`select id, description, source_type, qty, unit_price_paise, line_total_paise, is_active, deactivation_reason
          from invoice_items where invoice_id = ${id} order by created_at`,
    z.object({
      id: z.uuid(),
      description: z.string(),
      source_type: z.enum(['consultation', 'dispensing', 'lab', 'manual']),
      qty: z.number(),
      unit_price_paise: paise,
      line_total_paise: paise,
      is_active: z.boolean(),
      deactivation_reason: z.string().nullable(),
    }),
  );
  const corrections = await many(
    db,
    sql`select id, amount_paise, origin, reason, status, refund_may_be_due from billing_corrections where invoice_id = ${id} order by initiated_at`,
    z.object({
      id: z.uuid(),
      amount_paise: paise,
      origin: z.string(),
      reason: z.string(),
      status: z.string(),
      refund_may_be_due: z.boolean(),
    }),
  );
  const payments = await many(
    db,
    sql`select id, receipt_no, amount_paise, method, received_at from payments where invoice_id = ${id} order by received_at`,
    z.object({
      id: z.uuid(),
      receipt_no: z.string(),
      amount_paise: paise,
      method: z.string(),
      received_at: timestamptz,
    }),
  );
  const collectable =
    i.status === 'issued' || i.status === 'partially_paid'
      ? Math.max(0, i.total_paise - i.paid_paise - i.pending)
      : 0;
  return {
    id: i.id,
    invoiceNo: i.invoice_no,
    status: i.status,
    patient: { id: i.patient_id, mrn: i.mrn, name: i.patient_name },
    appointmentId: i.appointment_id,
    subtotalPaise: i.subtotal_paise,
    discountPaise: i.discount_paise,
    taxPaise: i.tax_paise,
    totalPaise: i.total_paise,
    paidPaise: i.paid_paise,
    pendingCorrectionsPaise: i.pending,
    collectablePaise: collectable,
    issuedAt: i.issued_at,
    lines: lines.map((l) => ({
      id: l.id,
      description: l.description,
      sourceType: l.source_type,
      qty: l.qty,
      unitPricePaise: l.unit_price_paise,
      lineTotalPaise: l.line_total_paise,
      isActive: l.is_active,
      deactivationReason: l.deactivation_reason,
    })),
    corrections: corrections.map((c) => ({
      id: c.id,
      amountPaise: c.amount_paise,
      origin: c.origin,
      reason: c.reason,
      status: c.status,
      refundMayBeDue: c.refund_may_be_due,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      receiptNo: p.receipt_no,
      amountPaise: p.amount_paise,
      method: p.method,
      receivedAt: p.received_at,
    })),
  };
}

export function createBillingService(db: Db) {
  return {
    get: (id: string) => invoiceById(db, id),

    async list(query: {
      status?: string | undefined;
      patientId?: string | undefined;
      appointmentId?: string | undefined;
    }): Promise<Invoice[]> {
      const ids = await many(
        db,
        sql`select id from invoices
             where (${query.status ?? null}::text is null or status = ${query.status ?? null})
               and (${query.patientId ?? null}::uuid is null or patient_id = ${query.patientId ?? null}::uuid)
               and (${query.appointmentId ?? null}::uuid is null or appointment_id = ${query.appointmentId ?? null}::uuid)
             order by created_at desc limit 50`,
        z.object({ id: z.uuid() }),
      );
      const out: Invoice[] = [];
      for (const { id } of ids) out.push(await invoiceById(db, id));
      return out;
    },

    /** Issue a draft (BL-1): it gets its gapless number and never changes again. */
    async issue(actor: AuthContext, id: string, meta: RequestMeta): Promise<Invoice> {
      await transaction(db, async (tx) => {
        const i = await maybeOne(
          tx,
          sql`select status, patient_id, total_paise from invoices where id = ${id} for update`,
          z.object({ status: z.string(), patient_id: z.uuid(), total_paise: paise }),
        );
        if (!i) throw notFound();
        if (i.status !== 'draft')
          throw new AppError(422, 'INVALID_STATE', 'Only a draft invoice can be issued.');
        const lines = await one(
          tx,
          sql`select count(*)::int as n from invoice_items where invoice_id = ${id} and is_active`,
          z.object({ n: z.number() }),
        );
        if (lines.n === 0)
          throw new AppError(422, 'INVALID_STATE', 'An invoice without charges cannot be issued.');
        const number = await nextDocumentNumber(tx, 'invoice');
        await run(
          tx,
          sql`update invoices set status = case when total_paise = 0 then 'paid' else 'issued' end, invoice_no = ${number},
                     issued_at = now(), issued_by = ${actor.userId}, version = version + 1 where id = ${id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'invoice.issued',
          entityType: 'invoice',
          entityId: id,
          patientId: i.patient_id,
          changes: { invoiceNo: number, totalPaise: i.total_paise },
        });
      });
      return invoiceById(db, id);
    },

    /**
     * Payment (BL-2 to BL-4, MB-3): never above the valid outstanding balance (total − paid − open
     * corrections); idempotent (BL-3); status recalculated from the amounts.
     */
    async pay(
      actor: AuthContext,
      id: string,
      input: {
        amountPaise: number;
        method: 'cash' | 'card' | 'upi' | 'bank';
        reference?: string | undefined;
      },
      key: string,
      meta: RequestMeta,
    ) {
      return idempotent(db, actor.userId, key, 'invoice.pay', { id, input }, async (tx) => {
        const i = await maybeOne(
          tx,
          sql`select i.status, i.patient_id, i.total_paise, i.paid_paise,
                     coalesce((select sum(amount_paise) from billing_corrections c where c.invoice_id = i.id and c.status = 'open'), 0) as pending
                from invoices i where i.id = ${id} for update`,
          z.object({
            status: z.string(),
            patient_id: z.uuid(),
            total_paise: paise,
            paid_paise: paise,
            pending: paise,
          }),
        );
        if (!i) throw notFound();
        if (i.status !== 'issued' && i.status !== 'partially_paid') {
          throw new AppError(
            422,
            'INVALID_STATE',
            i.status === 'draft'
              ? 'Issue the invoice before taking a payment.'
              : `This invoice is ${i.status.replace('_', ' ')}.`,
          );
        }
        const outstanding = i.total_paise - i.paid_paise;
        const collectable = outstanding - i.pending;
        if (input.amountPaise > collectable) {
          if (i.pending > 0 && input.amountPaise <= outstanding) {
            throw new AppError(
              422,
              'CORRECTION_PENDING',
              'Part of this invoice is for a cancelled service waiting for Finance. Collect at most the amount shown.',
            );
          }
          throw new AppError(
            422,
            'PAYMENT_EXCEEDS_BALANCE',
            'The amount is more than what is due on this invoice.',
          );
        }
        const receiptNo = await nextDocumentNumber(tx, 'receipt');
        const payment = await one(
          tx,
          sql`insert into payments (receipt_no, invoice_id, amount_paise, method, reference, received_by)
              values (${receiptNo}, ${id}, ${input.amountPaise}, ${input.method}, ${input.reference ?? null}, ${actor.userId})
              returning id, received_at`,
          z.object({ id: z.uuid(), received_at: timestamptz }),
        );
        const paid = i.paid_paise + input.amountPaise;
        await run(
          tx,
          sql`update invoices set paid_paise = ${paid}, status = case when ${paid} >= total_paise then 'paid' else 'partially_paid' end,
                     version = version + 1 where id = ${id}`,
        );
        await writeAudit(tx, userActor(actor.userId), meta, {
          action: 'payment.recorded',
          entityType: 'payment',
          entityId: payment.id,
          patientId: i.patient_id,
          changes: {
            invoiceId: id,
            amountPaise: input.amountPaise,
            method: input.method,
            receiptNo,
          },
        });
        const invoice = await invoiceById(tx, id);
        return {
          status: 201,
          body: {
            receiptNo,
            invoiceNo: invoice.invoiceNo ?? '',
            patient: { mrn: invoice.patient.mrn, name: invoice.patient.name },
            amountPaise: input.amountPaise,
            method: input.method,
            receivedAt: payment.received_at,
            balancePaise: invoice.totalPaise - invoice.paidPaise,
          },
        };
      });
    },

    async receipt(paymentId: string) {
      const p = await maybeOne(
        db,
        sql`select pay.receipt_no, i.invoice_no, pt.mrn, pt.first_name || ' ' || pt.last_name as name, pay.amount_paise, pay.method, pay.received_at,
                   i.total_paise - i.paid_paise as balance
              from payments pay join invoices i on i.id = pay.invoice_id join patients pt on pt.id = i.patient_id where pay.id = ${paymentId}`,
        z.object({
          receipt_no: z.string(),
          invoice_no: z.string(),
          mrn: z.string(),
          name: z.string(),
          amount_paise: paise,
          method: z.string(),
          received_at: timestamptz,
          balance: paise,
        }),
      );
      if (!p) throw notFound();
      return {
        receiptNo: p.receipt_no,
        invoiceNo: p.invoice_no,
        patient: { mrn: p.mrn, name: p.name },
        amountPaise: p.amount_paise,
        method: p.method,
        receivedAt: p.received_at,
        balancePaise: p.balance,
      };
    },

    async openCorrections() {
      const rows = await many(
        db,
        sql`select c.id, c.invoice_id, i.invoice_no, p.first_name || ' ' || p.last_name as patient_name, c.amount_paise, c.origin, c.reason,
                   c.initiated_at, c.refund_may_be_due
              from billing_corrections c join invoices i on i.id = c.invoice_id join patients p on p.id = i.patient_id
             where c.status = 'open' order by c.initiated_at limit 200`,
        z.object({
          id: z.uuid(),
          invoice_id: z.uuid(),
          invoice_no: z.string().nullable(),
          patient_name: z.string(),
          amount_paise: paise,
          origin: z.string(),
          reason: z.string(),
          initiated_at: timestamptz,
          refund_may_be_due: z.boolean(),
        }),
      );
      return rows.map((r) => ({
        id: r.id,
        invoiceId: r.invoice_id,
        invoiceNo: r.invoice_no,
        patientName: r.patient_name,
        amountPaise: r.amount_paise,
        origin: r.origin,
        reason: r.reason,
        initiatedAt: r.initiated_at,
        refundMayBeDue: r.refund_may_be_due,
      }));
    },
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
