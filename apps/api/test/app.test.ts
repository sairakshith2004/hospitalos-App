import {
  errorEnvelopeSchema,
  healthResponseSchema,
  readyResponseSchema,
} from '@hospitalos/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';

import { captureLogger } from './support/capture-logger';

function appWith(
  checkReadiness: () => Promise<void> = () => Promise.resolve(),
  rateLimit = { windowMs: 60_000, max: 300 },
) {
  const capture = captureLogger();
  return { app: createApp({ logger: capture.logger, checkReadiness, rateLimit }), ...capture };
}

describe('GET /api/health', () => {
  it('answers 200 with the documented body, without touching the database', async () => {
    let checked = false;
    const { app } = appWith(() => {
      checked = true;
      return Promise.resolve();
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: 'ok' });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(checked).toBe(false);
  });
});

describe('GET /api/ready', () => {
  it('answers 200 when the readiness check passes', async () => {
    const res = await request(appWith().app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(readyResponseSchema.parse(res.body)).toEqual({
      status: 'ready',
      checks: { database: 'ok' },
    });
  });

  it('answers 503 NOT_READY, without details, when the database is unavailable', async () => {
    const { app } = appWith(() =>
      Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5433 password=hunter2')),
    );
    const res = await request(app).get('/api/ready');
    expect(res.status).toBe(503);
    const body = errorEnvelopeSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_READY');
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|5433|hunter2/);
  });
});

describe('errors and security headers', () => {
  it('answers unknown routes with the 404 envelope and its request ID', async () => {
    const res = await request(appWith().app).get('/api/nope');
    expect(res.status).toBe(404);
    const body = errorEnvelopeSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('sends security headers and hides the framework', async () => {
    const res = await request(appWith().app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('keeps a valid incoming request ID and replaces an invalid one', async () => {
    const { app } = appWith();
    const kept = await request(app).get('/api/health').set('X-Request-Id', 'abcd-1234-efgh');
    expect(kept.headers['x-request-id']).toBe('abcd-1234-efgh');
    const replaced = await request(app).get('/api/health').set('X-Request-Id', 'bad id!<script>');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers malformed JSON with 400 INVALID_JSON', async () => {
    const res = await request(appWith().app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('INVALID_JSON');
  });

  it('answers bodies over the limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(appWith().app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('request logging', () => {
  it('redacts the Authorization header and never logs it', async () => {
    const { app, lines } = appWith();
    await request(app).get('/api/health').set('Authorization', 'Bearer hos_at_supersecrettoken');
    const logged = lines().join('\n');
    expect(logged).toContain('[redacted]');
    expect(logged).not.toContain('supersecrettoken');
  });
});

describe('rate limiting foundation', () => {
  it('answers 429 RATE_LIMITED with the envelope once the per-IP limit is exceeded', async () => {
    const { app } = appWith(undefined, { windowMs: 60_000, max: 2 });
    await request(app).get('/api/nope');
    await request(app).get('/api/nope');
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(429);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('RATE_LIMITED');
    expect(res.headers['ratelimit-policy'] ?? res.headers.ratelimit).toBeDefined();
  });

  it('never limits the liveness and readiness probes', async () => {
    const { app } = appWith(undefined, { windowMs: 60_000, max: 1 });
    for (let i = 0; i < 5; i += 1) {
      expect((await request(app).get('/api/health')).status).toBe(200);
      expect((await request(app).get('/api/ready')).status).toBe(200);
    }
  });
});

describe('production-safe errors', () => {
  it('never returns stack traces, SQL or internal messages', async () => {
    const { app } = appWith(() =>
      Promise.reject(new Error('select * from schema_migrations failed at /src/db/readiness.ts:12')),
    );
    const res = await request(app).get('/api/ready');
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/select|schema_migrations|readiness\.ts|\bat\b/i);
  });
});
