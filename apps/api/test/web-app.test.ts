import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { errorEnvelopeSchema } from '@hospitalos/contracts';
import type express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { webAppRouter } from '../src/http/static';
import { AppError } from '../src/lib/errors';

import { captureLogger } from './support/capture-logger';

const INDEX = '<!doctype html><title>HospitalOS</title><div id="root"></div>';

function webRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'hos-web-'));
  writeFileSync(join(dir, 'index.html'), INDEX);
  mkdirSync(join(dir, 'assets'));
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log(1);');
  writeFileSync(join(dir, '.env'), 'NOT_FOR_BROWSERS=1');
  return dir;
}

/** An app with a stand-in for the real authentication: every /api/v1 request is refused. */
function appWith(options: { webRoot?: string; tls?: boolean } = {}) {
  const passThrough: express.RequestHandler = (_req, _res, next) => {
    next();
  };
  const refuseAll: express.RequestHandler = () => {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  };
  return createApp({
    logger: captureLogger().logger,
    checkReadiness: () => Promise.resolve(),
    api: {
      modules: { gate: [passThrough], publicRouters: [], protectedRouters: [] },
      authenticate: refuseAll,
    },
    ...options,
  });
}

describe('web app served from the API origin', () => {
  const app = appWith({ webRoot: webRoot() });

  it('serves index.html at / and revalidates it on every load', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toBe(INDEX);
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('answers client-side routes with index.html so a reload keeps working', async () => {
    const res = await request(app).get('/patients/123/chart');
    expect(res.status).toBe(200);
    expect(res.text).toBe(INDEX);
  });

  it('caches hashed build assets for a year', async () => {
    const res = await request(app).get('/assets/index-abc123.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('answers a missing file with the 404 envelope, not the app shell', async () => {
    const res = await request(app).get('/favicon.png');
    expect(res.status).toBe(404);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('never serves dotfiles', async () => {
    const res = await request(app).get('/.env');
    expect(res.status).not.toBe(200);
    expect(res.text).not.toContain('NOT_FOR_BROWSERS');
  });

  it('keeps unauthenticated /api/v1 paths at 401, never the app shell', async () => {
    const res = await request(app).get('/api/v1/patients');
    expect(res.status).toBe(401);
    expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('UNAUTHENTICATED');
  });

  it('keeps unknown /api paths at the JSON 404 envelope', async () => {
    for (const path of ['/api', '/api/unknown', '/api/unknown/deep']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(errorEnvelopeSchema.parse(res.body).error.code).toBe('NOT_FOUND');
    }
  });

  it('keeps the health probe and security headers on web responses', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
    const res = await request(app).get('/');
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('does not answer non-GET requests with the app shell', async () => {
    const res = await request(app).post('/patients').send({});
    expect(res.status).toBe(404);
  });
});

describe('web app router setup', () => {
  it('refuses to start when the web root has no index.html', () => {
    const empty = mkdtempSync(join(tmpdir(), 'hos-web-empty-'));
    expect(() => webAppRouter(empty, '/api')).toThrow('index.html was not found');
  });

  it('is absent unless WEB_ROOT is configured', async () => {
    const res = await request(appWith()).get('/');
    expect(res.status).toBe(404);
  });
});

describe('Content-Security-Policy and HTTPS', () => {
  it('asks browsers to upgrade requests only when the listener is HTTPS', async () => {
    const plain = await request(appWith({ tls: false })).get('/api/health');
    expect(plain.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    const secure = await request(appWith({ tls: true })).get('/api/health');
    expect(secure.headers['content-security-policy']).toContain('upgrade-insecure-requests');
  });
});
