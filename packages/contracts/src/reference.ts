import { z } from 'zod';

import { dateSchema, paiseSchema, reasonSchema, uuidSchema } from './common';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM');

export const hospitalInfoSchema = z.object({
  name: z.string(),
  timezone: z.string(),
  currency: z.string(),
  /** Today in the hospital time zone, from the server clock (never the phone's). */
  today: dateSchema,
});

export const departmentSchema = z.object({
  code: z.string(),
  name: z.string(),
  isClinical: z.boolean(),
});
export const departmentListSchema = z.object({ items: z.array(departmentSchema) });

export const doctorSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  departmentCode: z.string(),
  departmentName: z.string(),
  specialty: z.string(),
  consultationFeePaise: paiseSchema,
  defaultSlotMinutes: z.number().int(),
  active: z.boolean(),
});
export type Doctor = z.infer<typeof doctorSchema>;
export const doctorListSchema = z.object({ items: z.array(doctorSchema) });

export const scheduleSchema = z.object({
  id: uuidSchema,
  weekday: z.number().int().min(1).max(7),
  startTime: time,
  endTime: time,
  slotMinutes: z.number().int(),
  validFrom: dateSchema,
  validTo: dateSchema.nullable(),
  active: z.boolean(),
});
export const scheduleListSchema = z.object({ items: z.array(scheduleSchema) });

export const createScheduleRequestSchema = z
  .strictObject({
    weekday: z.number().int().min(1).max(7),
    startTime: time,
    endTime: time,
    slotMinutes: z.number().int().min(5).max(120),
    validFrom: dateSchema.optional(),
    validTo: dateSchema.optional(),
    reason: reasonSchema,
  })
  .refine((s) => s.startTime < s.endTime, {
    path: ['endTime'],
    message: 'Must be after the start time',
  });

export const feeUpdateRequestSchema = z.strictObject({
  consultationFeePaise: paiseSchema,
  reason: reasonSchema,
});

export const serviceSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  kind: z.enum(['consultation', 'lab', 'procedure', 'other']),
  pricePaise: paiseSchema,
  departmentCode: z.string().nullable(),
  active: z.boolean(),
});
export const serviceListSchema = z.object({ items: z.array(serviceSchema) });
export const priceUpdateRequestSchema = z.strictObject({
  pricePaise: paiseSchema,
  reason: reasonSchema,
});

export const medicineSchema = z.object({
  stockItemId: uuidSchema,
  sku: z.string(),
  brandName: z.string(),
  dosageForm: z.string(),
  route: z.string(),
  packSize: z.string().nullable(),
  baseUnit: z.string(),
  rxOnly: z.boolean(),
  ingredients: z.array(z.object({ name: z.string(), strength: z.number(), unit: z.string() })),
  /** Units dispensable now: active, unexpired batches in the pharmacy. */
  availableQty: z.number().int(),
  nearestExpiry: dateSchema.nullable(),
});
export type Medicine = z.infer<typeof medicineSchema>;
export const medicineListSchema = z.object({ items: z.array(medicineSchema) });
export const medicineSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(60) });

export const labTestSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  sampleType: z.string(),
  turnaroundHours: z.number().int(),
  pricePaise: paiseSchema,
  parameters: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      unit: z.string().nullable(),
      refLow: z.number().nullable(),
      refHigh: z.number().nullable(),
      refText: z.string().nullable(),
    }),
  ),
});
export type LabTest = z.infer<typeof labTestSchema>;
export const labTestListSchema = z.object({ items: z.array(labTestSchema) });
