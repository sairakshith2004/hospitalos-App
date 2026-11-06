import { describe, expect, it } from 'vitest';

import { errorEnvelopeSchema } from '../errors';
import { healthResponseSchema, readyResponseSchema } from '../health';

describe('error envelope', () => {
  it('accepts the documented shape', () => {
    const body = { error: { code: 'NOT_FOUND', message: 'Not found', requestId: 'req-12345678' } };
    expect(errorEnvelopeSchema.parse(body)).toEqual(body);
  });

  it('rejects unknown codes and missing request IDs', () => {
    expect(
      errorEnvelopeSchema.safeParse({ error: { code: 'OOPS', message: 'x', requestId: 'r' } })
        .success,
    ).toBe(false);
    expect(
      errorEnvelopeSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'x' } }).success,
    ).toBe(false);
  });
});

describe('health and readiness', () => {
  it('accepts only the documented bodies', () => {
    expect(healthResponseSchema.safeParse({ status: 'ok' }).success).toBe(true);
    expect(healthResponseSchema.safeParse({ status: 'up' }).success).toBe(false);
    expect(
      readyResponseSchema.safeParse({ status: 'ready', checks: { database: 'ok' } }).success,
    ).toBe(true);
    expect(readyResponseSchema.safeParse({ status: 'ready', checks: {} }).success).toBe(false);
  });
});
