import { z } from 'zod';

import { paiseSchema, timestampSchema, uuidSchema } from './common';

export const invoiceSchema = z.object({
  id: uuidSchema,
  invoiceNo: z.string().nullable(),
  status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'void']),
  patient: z.object({ id: uuidSchema, mrn: z.string(), name: z.string() }),
  appointmentId: uuidSchema,
  subtotalPaise: paiseSchema,
  discountPaise: paiseSchema,
  taxPaise: paiseSchema,
  totalPaise: paiseSchema,
  paidPaise: paiseSchema,
  /** Open corrections for cancelled services: can't be collected while Finance decides (R3). */
  pendingCorrectionsPaise: paiseSchema,
  /** What may be collected now: total − paid − pending corrections. */
  collectablePaise: paiseSchema,
  issuedAt: timestampSchema.nullable(),
  lines: z.array(
    z.object({
      id: uuidSchema,
      description: z.string(),
      sourceType: z.enum(['consultation', 'dispensing', 'lab', 'manual']),
      qty: z.number().int(),
      unitPricePaise: paiseSchema,
      lineTotalPaise: paiseSchema,
      isActive: z.boolean(),
      deactivationReason: z.string().nullable(),
    }),
  ),
  corrections: z.array(
    z.object({
      id: uuidSchema,
      amountPaise: paiseSchema,
      origin: z.string(),
      reason: z.string(),
      status: z.string(),
      refundMayBeDue: z.boolean(),
    }),
  ),
  payments: z.array(
    z.object({
      id: uuidSchema,
      receiptNo: z.string(),
      amountPaise: paiseSchema,
      method: z.string(),
      receivedAt: timestampSchema,
    }),
  ),
});
export type Invoice = z.infer<typeof invoiceSchema>;
export const invoiceListSchema = z.object({ items: z.array(invoiceSchema) });

export const paymentRequestSchema = z.strictObject({
  amountPaise: z.number().int().positive(),
  method: z.enum(['cash', 'card', 'upi', 'bank']),
  reference: z.string().trim().max(80).optional(),
});
export const receiptSchema = z.object({
  receiptNo: z.string(),
  invoiceNo: z.string(),
  patient: z.object({ mrn: z.string(), name: z.string() }),
  amountPaise: paiseSchema,
  method: z.string(),
  receivedAt: timestampSchema,
  balancePaise: paiseSchema,
});
export const correctionListSchema = z.object({
  items: z.array(
    z.object({
      id: uuidSchema,
      invoiceId: uuidSchema,
      invoiceNo: z.string().nullable(),
      patientName: z.string(),
      amountPaise: paiseSchema,
      origin: z.string(),
      reason: z.string(),
      initiatedAt: timestampSchema,
      refundMayBeDue: z.boolean(),
    }),
  ),
});
