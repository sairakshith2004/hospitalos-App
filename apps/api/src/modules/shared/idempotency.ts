import { createHash } from 'node:crypto';

import { sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  maybeOne,
  PG,
  postgresErrorOf,
  run,
  transaction,
  type Db,
  type Executor,
} from '../../db/sql';
import { AppError } from '../../lib/errors';

export type IdempotentResult = Readonly<{ status: number; body: unknown }>;

const KEY = z.uuid();

/** The `Idempotency-Key` header (a UUID), required on booking, check-in, dispensing and payments. */
export function idempotencyKeyOf(header: string | undefined): string {
  const parsed = KEY.safeParse(header);
  if (!parsed.success) {
    throw new AppError(
      400,
      'IDEMPOTENCY_KEY_REQUIRED',
      'Send an Idempotency-Key header (a UUID) with this request.',
    );
  }
  return parsed.data;
}

function hashOf(scope: string, body: unknown): string {
  return createHash('sha256')
    .update(`${scope}\n${JSON.stringify(body)}`)
    .digest('hex');
}

async function stored(
  db: Executor,
  userId: string,
  key: string,
  scope: string,
  requestHash: string,
) {
  const row = await maybeOne(
    db,
    sql`select scope, request_hash, response_status, response_body from idempotency_keys
         where user_id = ${userId} and key = ${key}`,
    z.object({
      scope: z.string(),
      request_hash: z.string(),
      response_status: z.number(),
      response_body: z.unknown(),
    }),
  );
  if (!row) return undefined;
  if (row.scope !== scope || row.request_hash !== requestHash) {
    throw new AppError(
      422,
      'IDEMPOTENCY_KEY_REUSED',
      'This Idempotency-Key was already used for a different request.',
    );
  }
  return { status: row.response_status, body: row.response_body };
}

/**
 * Runs `work` once per (user, key). A retry with the same body returns the first result without
 * doing anything again (a double tap or a dropped connection can never book, dispense or charge
 * twice). The result is stored in the same transaction as the work, so both happen or neither.
 */
export async function idempotent(
  db: Db,
  userId: string,
  key: string,
  scope: string,
  body: unknown,
  work: (tx: Executor) => Promise<IdempotentResult>,
): Promise<IdempotentResult> {
  const requestHash = hashOf(scope, body);
  const previous = await stored(db, userId, key, scope, requestHash);
  if (previous) return previous;
  try {
    return await transaction(db, async (tx) => {
      const result = await work(tx);
      await run(
        tx,
        sql`insert into idempotency_keys (user_id, key, scope, request_hash, response_status, response_body)
            values (${userId}, ${key}, ${scope}, ${requestHash}, ${result.status}, ${JSON.stringify(result.body)}::jsonb)`,
      );
      return result;
    });
  } catch (error) {
    // A concurrent request with the same key committed first: return its result.
    if (postgresErrorOf(error)?.code === PG.uniqueViolation) {
      const winner = await stored(db, userId, key, scope, requestHash);
      if (winner) return winner;
    }
    throw error;
  }
}
