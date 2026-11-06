import { errorEnvelopeSchema, type ErrorCode, type FieldError } from '@hospitalos/contracts';

/** An error answer from the API, or a failure to reach it. Screens branch on `code`. */
export class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE',
    message: string,
    readonly fields: readonly FieldError[] = [],
    readonly requestId: string | null = null,
    /** The full error body, for answers that carry more than the envelope (duplicate candidates). */
    readonly body: unknown = null,
  ) {
    super(message);
  }
}

export function apiErrorFrom(status: number, body: unknown): ApiError {
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (!parsed.success)
    return new ApiError(status, 'INVALID_RESPONSE', 'The server sent an unexpected answer.');
  const { code, message, fields, requestId } = parsed.data.error;
  return new ApiError(status, code, message, fields ?? [], requestId, body);
}

/** A short, safe message for people. Never shows server internals. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR')
      return 'Cannot reach the HospitalOS server. Check the connection and try again.';
    if (error.code === 'INVALID_RESPONSE' || error.status >= 500)
      return 'Something went wrong on the server. Try again.';
    return error.message;
  }
  return 'Something went wrong. Try again.';
}
