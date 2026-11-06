import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

import {
  errorEnvelopeSchema,
  healthResponseSchema,
  readyResponseSchema,
} from '@hospitalos/contracts';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Starts the real server (src/server.ts) against hospitalos_test as hos_app, checks both probes
 * over HTTP, then sends SIGTERM and expects a clean exit. Uses its own port so it never collides
 * with a developer's API on 4000.
 */
const PORT = 4100;
const base = `http://127.0.0.1:${PORT}`;
const apiDir = fileURLToPath(new URL('../..', import.meta.url));
const tsx = fileURLToPath(new URL('../../../../node_modules/.bin/tsx', import.meta.url));

let child: ChildProcess | undefined;
let output = '';

afterAll(() => {
  if (child && child.exitCode === null) child.kill('SIGKILL');
});

async function waitForHealth(): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`server did not start:\n${output}`);
}

describe('API server process', () => {
  it('serves health and readiness, then shuts down cleanly on SIGTERM', async () => {
    child = spawn(tsx, ['src/server.ts'], {
      cwd: apiDir,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: String(PORT),
        LOG_LEVEL: 'info',
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        DATABASE_ALLOWED_NAMES: 'hospitalos_test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.stderr?.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));

    await waitForHealth();

    const health = await fetch(`${base}/api/health`);
    expect(health.status).toBe(200);
    expect(healthResponseSchema.parse(await health.json())).toEqual({ status: 'ok' });

    const ready = await fetch(`${base}/api/ready`);
    expect(ready.status).toBe(200);
    expect(readyResponseSchema.parse(await ready.json()).status).toBe('ready');

    const missing = await fetch(`${base}/api/v1/nothing-here`);
    expect(missing.status).toBe(404);
    expect(errorEnvelopeSchema.parse(await missing.json()).error.requestId).toBeTruthy();

    // The database closes the server's pooled connections (as on a restart). The process must
    // survive, keep answering, and reconnect for readiness.
    const killer = new pg.Client({
      connectionString: process.env.TEST_DATABASE_URL,
      application_name: 'hospitalos-test-killer',
    });
    await killer.connect();
    const terminated = await killer.query<{ count: string }>(
      `select count(*) from (select pg_terminate_backend(pid) from pg_stat_activity
        where application_name = 'hospitalos-api' and usename = 'hos_app'
          and datname = 'hospitalos_test' and pid <> pg_backend_pid()) t`,
    );
    await killer.end();
    expect(Number(terminated.rows[0]?.count)).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(child.exitCode).toBeNull();
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
    expect((await fetch(`${base}/api/ready`)).status).toBe(200);
    expect(output).toContain('idle database connection lost');
    expect(output).toContain('"pgErrorCode":"57P01"');

    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    await exited;
    expect(child.exitCode).toBe(0);
    expect(output).toContain('shutdown complete');

    // No secret from the connection string ever reaches the logs.
    const password = new URL(process.env.TEST_DATABASE_URL ?? '').password;
    expect(password.length).toBeGreaterThan(0);
    expect(output).not.toContain(password);
  }, 30_000);

  it('refuses to start when connected as the owner instead of hos_app', async () => {
    const refused = spawn(tsx, ['src/server.ts'], {
      cwd: apiDir,
      env: {
        PATH: process.env.PATH,
        NODE_ENV: 'test',
        PORT: String(PORT + 1),
        DATABASE_URL: process.env.TEST_MIGRATION_DATABASE_URL,
        DATABASE_ALLOWED_NAMES: 'hospitalos_test',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    refused.stdout.on('data', (chunk: Buffer) => (log += chunk.toString('utf8')));
    await once(refused, 'exit');
    expect(refused.exitCode).toBe(1);
    expect(log).toContain('refusing to start');
  }, 30_000);
});
