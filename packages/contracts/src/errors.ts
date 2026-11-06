import { z } from 'zod';

/**
 * Stable error codes. Clients branch on `code`, never on `message`. 401, 403 and 404 never say
 * why, so they reveal nothing about records the caller may not see.
 */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'INVALID_JSON',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'NOT_READY',
  'INTERNAL_ERROR',
  'PASSWORD_CHANGE_REQUIRED',
  'INVALID_CREDENTIALS',
  'INVALID_RESET_CODE',
  'APP_UPDATE_REQUIRED',
  'STALE_VERSION',
  'IDEMPOTENCY_KEY_REUSED',
  'IDEMPOTENCY_KEY_REQUIRED',
  'UNPROCESSABLE',
  'SLOT_UNAVAILABLE',
  'INSUFFICIENT_STOCK',
  'PRESCRIPTION_EXPIRED',
  'PAYMENT_EXCEEDS_BALANCE',
  'CORRECTION_PENDING',
  'INVALID_STATE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Every error response from the API has exactly this shape. */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    requestId: z.string(),
    fields: z.array(fieldErrorSchema).optional(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
