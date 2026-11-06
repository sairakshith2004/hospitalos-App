import { z } from 'zod';

import { dateSchema, reasonSchema, timestampSchema, uuidSchema } from './common';

export const prescriptionItemRequestSchema = z.strictObject({
  stockItemId: uuidSchema,
  dose: z.string().trim().min(1).max(60),
  frequency: z.string().trim().min(1).max(60),
  route: z.enum(['oral', 'topical', 'iv', 'im', 'sc', 'inhalation', 'ophthalmic', 'otic', 'nasal']),
  durationDays: z.number().int().min(1).max(365).optional(),
  qtyPrescribed: z.number().int().min(1).max(1000),
  substitutionAllowed: z.boolean().default(false),
  instructions: z.string().trim().max(300).optional(),
});
export const createPrescriptionRequestSchema = z.strictObject({
  items: z.array(prescriptionItemRequestSchema).min(1).max(20),
  notes: z.string().trim().max(1000).optional(),
  /** Required when an item matches a recorded allergy: the doctor saw the warning. */
  allergyAcknowledged: z.boolean().default(false),
});

export const prescriptionSchema = z.object({
  id: uuidSchema,
  rxNo: z.string(),
  status: z.enum(['issued', 'partially_dispensed', 'dispensed', 'cancelled', 'closed']),
  issuedAt: timestampSchema,
  validUntil: dateSchema,
  expired: z.boolean(),
  patient: z.object({ id: uuidSchema, mrn: z.string(), name: z.string() }),
  doctorName: z.string(),
  allergies: z.array(z.object({ substance: z.string(), severity: z.string() })),
  items: z.array(
    z.object({
      id: uuidSchema,
      stockItemId: uuidSchema,
      medicineName: z.string(),
      dose: z.string(),
      frequency: z.string(),
      route: z.string(),
      durationDays: z.number().nullable(),
      qtyPrescribed: z.number().int(),
      qtyDispensed: z.number().int(),
      substitutionAllowed: z.boolean(),
      allergyAcknowledged: z.boolean(),
      instructions: z.string().nullable(),
    }),
  ),
});
export type Prescription = z.infer<typeof prescriptionSchema>;
export const prescriptionListSchema = z.object({ items: z.array(prescriptionSchema) });

export const dispenseRequestSchema = z.strictObject({
  lines: z
    .array(
      z.strictObject({
        prescriptionItemId: uuidSchema,
        qty: z.number().int().min(1).max(1000),
        substituteStockItemId: uuidSchema.optional(),
        acknowledgeNearExpiry: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(20),
});
export const dispensingSchema = z.object({
  id: uuidSchema,
  dispenseNo: z.string(),
  prescriptionStatus: z.string(),
  lines: z.array(
    z.object({
      prescriptionItemId: uuidSchema,
      batchNo: z.string(),
      expiryDate: dateSchema.nullable(),
      qty: z.number().int(),
      unitPricePaise: z.number().int(),
    }),
  ),
});
export const cancelPrescriptionRequestSchema = z.strictObject({ reason: reasonSchema });
