import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname } from 'node:path';

/** The control listener only ever binds here: it is unreachable from other computers. */
export const CONTROL_HOST = '127.0.0.1';

const TOKEN_HEADER = /^Bearer ([A-Za-z0-9_-]{43})$/;

export type ControlToken = Readonly<{ value: string; file: string; remove: () => void }>;

/**
 * Creates a fresh random token for this run and writes it to `file` (owner-only permissions where
 * the file system supports them; Windows ACLs are applied by the W2 setup). Whoever can read the
 * file can stop the server, which is exactly the person allowed to run stop.bat.
 */
export function writeControlToken(file: string): ControlToken {
  const value = randomBytes(32).toString('base64url');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${value}\n`, { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Not supported on every file system; access is then governed by the folder's ACL.
  }
  return {
    value,
    file,
    remove: () => {
      rmSync(file, { force: true });
    },
  };
}

function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Loopback-only control listener: `POST /shutdown` with `Authorization: Bearer <token>` answers
 * 202 and starts a graceful shutdown. Everything else answers 404; a wrong or missing token 401.
 * No body is read, no other actions exist, and requests from non-loopback peers are refused even
 * though the socket is bound to 127.0.0.1.
 */
export function createControlServer(token: string, onShutdown: () => void): Server {
  return createServer((req, res) => {
    const peer = req.socket.remoteAddress ?? '';
    const loopback = peer === '127.0.0.1' || peer === '::1' || peer === '::ffff:127.0.0.1';
    const send = (status: number): void => {
      res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end();
    };
    if (!loopback) {
      send(403);
      return;
    }
    if (req.method !== 'POST' || req.url !== '/shutdown') {
      send(404);
      return;
    }
    const match = TOKEN_HEADER.exec(req.headers.authorization ?? '');
    if (!match?.[1] || !sameToken(match[1], token)) {
      send(401);
      return;
    }
    send(202);
    setImmediate(onShutdown);
  });
}
