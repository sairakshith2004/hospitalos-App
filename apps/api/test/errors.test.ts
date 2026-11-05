import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError, toHttpError } from '../src/lib/errors';
import { errorHandler } from '../src/middleware/error-handler';

import { captureLogger } from './support/capture-logger';

describe('toHttpError', () => {
  it('passes AppError through', () => {
    expect(toHttpError(new AppError(409, 'CONFLICT', 'Already booked.'))).toEqual({
      status: 409,
      code: 'CONFLICT',
      message: 'Already booked.',
    });
  });

  it('maps validation errors to 422 with field paths', () => {
    const result = z.object({ name: z.string() }).safeParse({ name: 1 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const mapped = toHttpError(result.error);
    expect(mapped.status).toBe(422);
    expect(mapped.code).toBe('VALIDATION_FAILED');
    expect(mapped.fields?.[0]?.path).toBe('name');
  });

  it('turns unknown errors into a generic 500', () => {
    expect(toHttpError(new Error('database password is hunter2'))).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong.',
    });
    expect(toHttpError('a string')).toMatchObject({ status: 500 });
  });
});

describe('errorHandler', () => {
  it('never sends the internal message or stack, and logs the failure', async () => {
    const { logger, lines } = captureLogger();
    const app = express();
    app.get('/boom', () => {
      throw new Error('internal detail hunter2');
    });
    app.use(errorHandler(logger));
    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('at ');
    expect(lines().some((line) => line.includes('request failed'))).toBe(true);
  });
});
