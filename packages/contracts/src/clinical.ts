import { z } from 'zod';

import { dateSchema, reasonSchema, timestampSchema, uuidSchema } from './common';
import { allergySchema, patientSummarySchema } from './patients';

export const vitalsRequestSchema = z
  .strictObject({
    appointmentId: uuidSchema,
    tempC: z.number().min(30).max(45).optional(),
    pulse: z.number().int().min(20).max(250).optional(),
    bpSys: z.number().int().min(50).max(260).optional(),
    bpDia: z.number().int().min(20).max(160).optional(),
    respRate: z.number().int().min(4).max(80).optional(),
    spo2: z.number().int().min(50).max(100).optional(),
    weightKg: z.number().min(0.3).max(400).optional(),
    heightCm: z.number().min(20).max(260).optional(),
  })
  .refine((v) => (v.bpSys === undefined) === (v.bpDia === undefined), {
    path: ['bpDia'],
    message: 'Enter both blood pressure values',
  })
  .refine(
    (v) =>
      [v.tempC, v.pulse, v.bpSys, v.respRate, v.spo2, v.weightKg, v.heightCm].some(
        (x) => x !== undefined,
      ),
    { path: ['tempC'], message: 'Enter at least one measurement' },
  );

export const vitalsSchema = z.object({
  id: uuidSchema,
  recordedAt: timestampSchema,
  recordedBy: z.string(),
  tempC: z.number().nullable(),
  pulse: z.number().nullable(),
  bpSys: z.number().nullable(),
  bpDia: z.number().nullable(),
  respRate: z.number().nullable(),
  spo2: z.number().nullable(),
  weightKg: z.number().nullable(),
  heightCm: z.number().nullable(),
});

export const noteRequestSchema = z.strictObject({
  kind: z.enum(['symptoms', 'observation', 'plan', 'addendum']),
  body: z.string().trim().min(1).max(5000),
});
export const diagnosisRequestSchema = z.strictObject({
  description: z.string().trim().min(1).max(300),
  code: z.string().trim().max(20).optional(),
  isPrimary: z.boolean().default(false),
});
export const startEncounterRequestSchema = z.strictObject({
  appointmentId: uuidSchema,
  chiefComplaint: z.string().trim().max(500).optional(),
});
export const errorEncounterRequestSchema = z.strictObject({ reason: reasonSchema });

export const encounterSchema = z.object({
  id: uuidSchema,
  encounterNo: z.string(),
  appointmentId: uuidSchema,
  patientId: uuidSchema,
  status: z.enum(['in_progress', 'completed', 'entered_in_error']),
  chiefComplaint: z.string().nullable(),
  startedAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
  notes: z.array(
    z.object({
      id: uuidSchema,
      kind: z.string(),
      body: z.string(),
      author: z.string(),
      createdAt: timestampSchema,
    }),
  ),
  diagnoses: z.array(
    z.object({
      id: uuidSchema,
      description: z.string(),
      code: z.string().nullable(),
      isPrimary: z.boolean(),
    }),
  ),
});
export type Encounter = z.infer<typeof encounterSchema>;

export const chartSchema = z.object({
  patient: patientSummarySchema,
  allergies: z.array(allergySchema),
  vitals: z.array(vitalsSchema),
  encounters: z.array(encounterSchema),
  labResults: z.array(
    z.object({
      orderId: uuidSchema,
      orderNo: z.string(),
      testName: z.string(),
      verifiedAt: timestampSchema,
      results: z.array(
        z.object({
          parameter: z.string(),
          value: z.string(),
          unit: z.string().nullable(),
          flag: z.string().nullable(),
        }),
      ),
    }),
  ),
});

export const nurseAssignmentRequestSchema = z.strictObject({
  nurseUserId: uuidSchema,
  doctorScheduleId: uuidSchema,
  sessionDate: dateSchema,
});
export const nurseAssignmentSchema = z.object({
  id: uuidSchema,
  nurseUserId: uuidSchema,
  nurseName: z.string(),
  doctorId: uuidSchema,
  doctorName: z.string(),
  scheduleId: uuidSchema,
  sessionDate: dateSchema,
  startTime: z.string(),
  endTime: z.string(),
});
export const nurseAssignmentListSchema = z.object({ items: z.array(nurseAssignmentSchema) });

export const followUpRequestSchema = z.strictObject({
  reason: z.string().trim().min(1).max(300),
  instructions: z.string().trim().max(500).optional(),
  dueFrom: dateSchema,
  dueTo: dateSchema,
  targetDoctorId: uuidSchema.optional(),
});
export const followUpSchema = z.object({
  id: uuidSchema,
  patient: z.object({ id: uuidSchema, mrn: z.string(), name: z.string() }),
  reason: z.string(),
  instructions: z.string().nullable(),
  dueFrom: dateSchema,
  dueTo: dateSchema,
  status: z.enum(['pending', 'booked', 'completed', 'missed', 'cancelled']),
  /** Computed when read: pending and the window has started (due) or ended (overdue). */
  timing: z.enum(['upcoming', 'due', 'overdue', 'none']),
  targetDoctorId: uuidSchema.nullable(),
  bookedAppointmentId: uuidSchema.nullable(),
});
export const followUpListSchema = z.object({ items: z.array(followUpSchema) });
