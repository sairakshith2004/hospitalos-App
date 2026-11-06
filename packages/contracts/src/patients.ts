import { z } from 'zod';

import { dateSchema, timestampSchema, uuidSchema } from './common';

const name = z.string().trim().min(1, 'Required').max(60);
const phone = z
  .string()
  .trim()
  .regex(/^[0-9]{7,15}$/, '7–15 digits, no spaces');

export const SEXES = ['female', 'male', 'other', 'unknown'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const registerPatientRequestSchema = z.strictObject({
  firstName: name,
  lastName: name,
  dob: dateSchema,
  sex: z.enum(SEXES),
  phone,
  email: z.email().max(254).optional(),
  address: z.string().trim().max(300).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  /** Set after the person confirmed that the possible duplicates are different patients. */
  confirmNotDuplicate: z.boolean().default(false),
});
export type RegisterPatientRequest = z.infer<typeof registerPatientRequestSchema>;

export const updateDemographicsRequestSchema = registerPatientRequestSchema
  .omit({ confirmNotDuplicate: true })
  .partial()
  .extend({ version: z.number().int().min(1) });
export type UpdateDemographicsRequest = z.infer<typeof updateDemographicsRequestSchema>;

/** Demographics: what reception, billing and other departments may see. */
export const patientSummarySchema = z.object({
  id: uuidSchema,
  mrn: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  dob: dateSchema,
  ageYears: z.number().int(),
  sex: z.enum(SEXES),
  phone: z.string(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  bloodGroup: z.string().nullable(),
  version: z.number().int(),
  createdAt: timestampSchema,
});
export type PatientSummary = z.infer<typeof patientSummarySchema>;

export const duplicateCandidateSchema = z.object({
  id: uuidSchema,
  mrn: z.string(),
  name: z.string(),
  dob: dateSchema,
  phone: z.string(),
  reason: z.enum(['same_phone_and_dob', 'similar_name_and_dob']),
});

/** 409 body when possible duplicates exist and the registrar has not confirmed. */
export const duplicateWarningSchema = z.object({
  error: z.object({ code: z.literal('CONFLICT'), message: z.string(), requestId: z.string() }),
  candidates: z.array(duplicateCandidateSchema),
});

export const patientSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(60) });
export const patientSearchResultSchema = z.object({ items: z.array(patientSummarySchema) });

export const allergySchema = z.object({
  id: uuidSchema,
  substance: z.string(),
  reaction: z.string().nullable(),
  severity: z.enum(['mild', 'moderate', 'severe', 'unknown']),
  status: z.enum(['active', 'inactive']),
  recordedAt: timestampSchema,
});
export const recordAllergyRequestSchema = z.strictObject({
  substance: z.string().trim().min(1).max(120),
  reaction: z.string().trim().max(300).optional(),
  severity: z.enum(['mild', 'moderate', 'severe', 'unknown']).default('unknown'),
});

export const visitSummarySchema = z.object({
  appointmentId: uuidSchema,
  appointmentNo: z.string(),
  visitDate: dateSchema,
  status: z.string(),
  doctorName: z.string(),
  departmentName: z.string(),
});
export const visitHistorySchema = z.object({ items: z.array(visitSummarySchema) });
