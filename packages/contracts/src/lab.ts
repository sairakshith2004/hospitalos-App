import { z } from 'zod';

import { reasonSchema, timestampSchema, uuidSchema } from './common';

export const LAB_STATUSES = [
  'ordered',
  'sample_collected',
  'in_process',
  'resulted',
  'verified',
  'cancelled',
] as const;

export const createLabOrderRequestSchema = z.strictObject({
  testId: uuidSchema,
  priority: z.enum(['routine', 'urgent']).default('routine'),
  clinicalNotes: z.string().trim().max(500).optional(),
});
export const collectSampleRequestSchema = z.strictObject({
  barcode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,40}$/, '4–40 letters, digits or dashes'),
});
export const rejectSampleRequestSchema = z.strictObject({ reason: reasonSchema });
export const enterResultsRequestSchema = z.strictObject({
  results: z
    .array(
      z
        .strictObject({
          parameterId: uuidSchema,
          valueNum: z.number().optional(),
          valueText: z.string().trim().max(200).optional(),
        })
        .refine((r) => r.valueNum !== undefined || (r.valueText ?? '') !== '', {
          message: 'Enter a value',
        }),
    )
    .min(1),
});

export const labOrderSchema = z.object({
  id: uuidSchema,
  orderNo: z.string(),
  status: z.enum(LAB_STATUSES),
  priority: z.enum(['routine', 'urgent']),
  test: z.object({ id: uuidSchema, code: z.string(), name: z.string(), sampleType: z.string() }),
  patient: z.object({ id: uuidSchema, mrn: z.string(), name: z.string() }),
  orderedAt: timestampSchema,
  sampleBarcode: z.string().nullable(),
  resultedBy: uuidSchema.nullable(),
  results: z.array(
    z.object({
      parameterId: uuidSchema,
      parameter: z.string(),
      valueNum: z.number().nullable(),
      valueText: z.string().nullable(),
      unit: z.string().nullable(),
      refLow: z.number().nullable(),
      refHigh: z.number().nullable(),
      flag: z.enum(['low', 'normal', 'high']).nullable(),
    }),
  ),
});
export type LabOrder = z.infer<typeof labOrderSchema>;
export const labOrderListSchema = z.object({ items: z.array(labOrderSchema) });
export const cancelLabOrderRequestSchema = z.strictObject({ reason: reasonSchema });
