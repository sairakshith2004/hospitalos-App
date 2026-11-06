import { z } from 'zod';

import { dateSchema, reasonSchema, timestampSchema, uuidSchema } from './common';

export const APPOINTMENT_STATUSES = [
  'booked',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
  'rescheduled',
] as const;
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES);

export const slotSchema = z.object({
  start: timestampSchema,
  end: timestampSchema,
  scheduleId: uuidSchema,
});
export const availabilitySchema = z.object({
  doctorId: uuidSchema,
  date: dateSchema,
  slots: z.array(slotSchema),
});
export const availabilityQuerySchema = z.object({ date: dateSchema });

export const bookAppointmentRequestSchema = z.strictObject({
  patientId: uuidSchema,
  doctorId: uuidSchema,
  slotStart: timestampSchema,
  followUpId: uuidSchema.optional(),
});
export const walkInRequestSchema = z.strictObject({ patientId: uuidSchema, doctorId: uuidSchema });
export const cancelRequestSchema = z.strictObject({ reason: reasonSchema });
export const rescheduleRequestSchema = z.strictObject({
  slotStart: timestampSchema,
  reason: reasonSchema,
});

export const appointmentSchema = z.object({
  id: uuidSchema,
  appointmentNo: z.string(),
  kind: z.enum(['scheduled', 'walk_in', 'follow_up']),
  status: appointmentStatusSchema,
  /** A booked appointment whose day has passed: shown as "did not arrive" (not stored). */
  didNotArrive: z.boolean(),
  visitDate: dateSchema,
  slotStart: timestampSchema.nullable(),
  slotEnd: timestampSchema.nullable(),
  tokenNo: z.number().int().nullable(),
  patient: z.object({ id: uuidSchema, mrn: z.string(), name: z.string() }),
  doctor: z.object({ id: uuidSchema, name: z.string(), departmentName: z.string() }),
  checkedInAt: timestampSchema.nullable(),
  cancelReason: z.string().nullable(),
  version: z.number().int(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const appointmentListSchema = z.object({ items: z.array(appointmentSchema) });
export const appointmentListQuerySchema = z.object({
  date: dateSchema.optional(),
  doctorId: uuidSchema.optional(),
  status: appointmentStatusSchema.optional(),
});
