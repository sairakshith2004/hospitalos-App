import {
  argon2,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
  type Argon2Parameters,
} from 'node:crypto';

/**
 * Token, password and code cryptography (architecture §5.2, §5.4).
 * - Tokens: `hos_at_` / `hos_rt_` + 32 random bytes; only their SHA-256 is stored.
 * - Passwords: argon2id (Node's built-in implementation), OWASP parameters, PHC string format.
 * - Reset codes: 8 random digits; only HMAC-SHA256(pepper, user ‖ code) is stored.
 */

export type TokenKind = 'access' | 'refresh';

const PREFIX: Readonly<Record<TokenKind, string>> = { access: 'hos_at_', refresh: 'hos_rt_' };

export function newToken(kind: TokenKind): string {
  return PREFIX[kind] + randomBytes(32).toString('base64url');
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hmacHex(key: string, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

/** Constant-time comparison of two hex digests of equal length. */
export function sameHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/** An 8-digit one-time code, uniformly random, leading zeros kept. */
export function newResetCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

// OWASP recommendation for argon2id: 19 MiB memory, 2 passes, 1 lane.
const MEMORY_KIB = 19_456;
const PASSES = 2;
const PARALLELISM = 1;
const TAG_LENGTH = 32;

function derive(password: string, salt: Buffer, memory: number, passes: number, lanes: number) {
  const parameters: Argon2Parameters = {
    message: password,
    nonce: salt,
    parallelism: lanes,
    tagLength: TAG_LENGTH,
    memory,
    passes,
  };
  return new Promise<Buffer>((resolve, reject) => {
    argon2('argon2id', parameters, (error, key) => {
      if (error) reject(error);
      else resolve(Buffer.from(key));
    });
  });
}

const b64 = (value: Buffer) => value.toString('base64').replace(/=+$/, '');

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, MEMORY_KIB, PASSES, PARALLELISM);
  return `$argon2id$v=19$m=${MEMORY_KIB},t=${PASSES},p=${PARALLELISM}$${b64(salt)}$${b64(key)}`;
}

const PHC = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const match = PHC.exec(stored);
  if (!match) return false;
  const [, m = '', t = '', p = '', salt = '', hash = ''] = match;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(
    password,
    Buffer.from(salt, 'base64'),
    Number(m),
    Number(t),
    Number(p),
  );
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * A real hash of a random password, checked when the username is unknown so that sign-in takes
 * the same time whether or not the account exists.
 */
let dummyHash: Promise<string> | undefined;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64url'));
  return dummyHash;
}
