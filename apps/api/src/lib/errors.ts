import type { ErrorCode, FieldError } from '@hospitalos/contracts';
import { ZodError } from 'zod';

/** An error the API answers deliberately, with a stable code and a safe message. */
export class AppError extends Error {
  override name = 'AppError';

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: readonly FieldError[],
  ) {
    super(message);
  }
}

export type HttpError = Readonly<{
  status: number;
  code: ErrorCode;
  message: string;
  fields?: readonly FieldError[];
}>;

function hasStringType(value: unknown): value is { type: string } {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
}

/**
 * Maps anything thrown inside a request to the response the client sees. Unknown errors become a
 * generic 500: their message and stack never reach the client.
 */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof AppError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      ...(error.fields ? { fields: error.fields } : {}),
    };
  }
  if (error instanceof ZodError) {
    return {
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'Some fields are not valid.',
      fields: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  if (hasStringType(error)) {
    if (error.type === 'entity.too.large') {
      return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' };
    }
    if (error.type === 'entity.parse.failed') {
      return { status: 400, code: 'INVALID_JSON', message: 'The request body is not valid JSON.' };
    }
    if (error.type.startsWith('charset.') || error.type.startsWith('encoding.')) {
      return { status: 400, code: 'BAD_REQUEST', message: 'The request could not be read.' };
    }
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong.' };
}
