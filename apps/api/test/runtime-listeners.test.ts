import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { request as httpRequest, type Server } from 'node:http';
import { get as httpsGet } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createControlServer, writeControlToken } from '../src/http/control';
import { createListener } from '../src/http/listen';
import { createServerLogger } from '../src/lib/logger';

const open: Server[] = [];
afterEach(async () => {
  await Promise.all(
    open.splice(0).map(
      (s) =>
        new Promise<void>((resolve) =>
          s.close(() => {
            resolve();
          }),
        ),
    ),
  );
});

function listen(server: Server): Promise<number> {
  open.push(server);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address !== null ? address.port : 0);
    });
  });
}

function call(port: number, method: string, path: string, token?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('control listener (graceful stop)', () => {
  it('writes a fresh owner-only token file and removes it on request', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'hos-ctl-')), 'run', 'control.token');
    const first = writeControlToken(file);
    expect(readFileSync(file, 'utf8').trim()).toBe(first.value);
    expect(first.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600);
    const second = writeControlToken(file);
    expect(second.value).not.toBe(first.value);
    second.remove();
    expect(existsSync(file)).toBe(false);
  });

  it('stops only on POST /shutdown with the right token', async () => {
    let stops = 0;
    const token = 'a'.repeat(43);
    const port = await listen(
      createControlServer(token, () => {
        stops += 1;
      }),
    );
    expect(await call(port, 'POST', '/shutdown')).toBe(401);
    expect(await call(port, 'POST', '/shutdown', 'b'.repeat(43))).toBe(401);
    expect(await call(port, 'POST', '/shutdown', 'short')).toBe(401);
    expect(await call(port, 'GET', '/shutdown', token)).toBe(404);
    expect(await call(port, 'POST', '/other', token)).toBe(404);
    expect(stops).toBe(0);
    expect(await call(port, 'POST', '/shutdown', token)).toBe(202);
    await new Promise((resolve) => setImmediate(resolve));
    expect(stops).toBe(1);
  });
});

describe('main listener', () => {
  it('is plain HTTP without certificate files', () => {
    const server = createListener(() => undefined);
    expect(server.constructor.name).toBe('Server');
  });

  it('names the setting, not the content, when a certificate file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hos-tls-'));
    expect(() =>
      createListener(() => undefined, {
        certFile: join(dir, 'missing.crt'),
        keyFile: join(dir, 'missing.key'),
      }),
    ).toThrow('TLS_CERT_FILE: the file could not be read');
  });

  // Certificates are generated per run (never committed); skipped where openssl is unavailable.
  const opensslAvailable = (() => {
    try {
      execFileSync('openssl', ['version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();

  it.runIf(opensslAvailable)('serves HTTPS with a configured certificate', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hos-tls-'));
    const certFile = join(dir, 'server.crt');
    const keyFile = join(dir, 'server.key');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-subj',
        '/CN=localhost',
        '-keyout',
        keyFile,
        '-out',
        certFile,
      ],
      { stdio: 'ignore' },
    );
    const server = createListener(
      (_req, res) => {
        res.end('secure');
      },
      { certFile, keyFile },
    );
    const port = await listen(server);
    const body = await new Promise<string>((resolve, reject) => {
      httpsGet(
        { host: '127.0.0.1', port, path: '/', ca: readFileSync(certFile), servername: 'localhost' },
        (res) => {
          let text = '';
          res.on('data', (chunk: Buffer) => (text += chunk.toString('utf8')));
          res.on('end', () => {
            resolve(text);
          });
        },
      ).on('error', reject);
    });
    expect(body).toBe('secure');
  });
});

describe('server log file', () => {
  it('appends redacted JSON lines to the configured file', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'hos-log-')), 'logs', 'api.log');
    const logger = createServerLogger('info', file);
    logger.info({ password: 'NeverLogThisPassword123' }, 'log file check');
    logger.flush();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('log file check');
    expect(text).not.toContain('NeverLogThisPassword123');
  });
});
