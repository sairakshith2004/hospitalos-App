import { type SQL } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import { z } from 'zod';

/**
 * Query helpers on top of Drizzle's `sql` template (parameters are always bound, never
 * concatenated). Every row is parsed with a Zod schema, so a column that is missing or of the wrong
 * type fails loudly instead of flowing on as `unknown`.
 */
export type Db = NodePgDatabase;

/** Anything that can run a query: the database or an open transaction. */
export type Executor = Pick<Db, 'execute'>;

export function createDatabase(pool: pg.Pool): Db {
  return drizzle(pool);
}

export async function many<T extends z.ZodType>(
  db: Executor,
  query: SQL,
  schema: T,
): Promise<z.infer<T>[]> {
  const result = await db.execute(query);
  return z.array(schema).parse(result.rows);
}

export async function maybeOne<T extends z.ZodType>(
  db: Executor,
  query: SQL,
  schema: T,
): Promise<z.infer<T> | undefined> {
  const rows = await many(db, query, schema);
  if (rows.length > 1) throw new Error('expected at most one row');
  return rows[0];
}

export async function one<T extends z.ZodType>(
  db: Executor,
  query: SQL,
  schema: T,
): Promise<z.infer<T>> {
  const row = await maybeOne(db, query, schema);
  if (row === undefined) throw new Error('expected exactly one row');
  return row;
}

/** Runs a statement and returns the number of rows it touched. */
export async function run(db: Executor, query: SQL): Promise<number> {
  const result = await db.execute(query);
  return result.rowCount ?? 0;
}

/** Runs `work` in one transaction (READ COMMITTED unless stated). */
export function transaction<T>(
  db: Db,
  work: (tx: Executor) => Promise<T>,
  isolationLevel: 'read committed' | 'repeatable read' | 'serializable' = 'read committed',
): Promise<T> {
  return db.transaction((tx) => work(tx), { isolationLevel });
}

const PG_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)$/;

/** Parses a timestamptz as Drizzle returns it (`2026-11-06 10:00:00.123+00`) or a Date. */
function toInstant(value: string | Date): Date {
  if (value instanceof Date) return value;
  const match = PG_TIMESTAMP.exec(value);
  if (!match) return new Date(Number.NaN);
  const [, day = '', time = '', zone = ''] = match;
  const offset =
    zone === 'Z'
      ? 'Z'
      : /^[+-]\d{2}$/.test(zone)
        ? `${zone}:00`
        : zone.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2');
  return new Date(`${day}T${time}${offset}`);
}

/** A timestamptz column as a Date (invalid input fails the parse). */
export const instant = z
  .union([z.string(), z.date()])
  .transform(toInstant)
  .pipe(z.date().refine((d) => !Number.isNaN(d.getTime()), 'invalid timestamp'));
export const nullableInstant = instant.nullable();

/** A timestamptz column as the ISO string the API returns. */
export const timestamptz = instant.transform((value) => value.toISOString());
export const nullableTimestamptz = nullableInstant.transform((value) =>
  value === null ? null : value.toISOString(),
);

/** `date` columns are read as text (see client type parser), already `YYYY-MM-DD`. */
export const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** bigint columns arrive as strings; convert only where values are known to fit. */
export const bigintNumber = z
  .union([z.string(), z.number()])
  .transform((value) => Number(value))
  .pipe(z.number().int());

const pgErrorShape = z.object({
  code: z.string(),
  constraint: z.string().optional(),
});

/** The PostgreSQL error inside anything thrown by a query (Drizzle wraps it in `cause`). */
export function postgresErrorOf(
  error: unknown,
): Readonly<{ code: string; constraint?: string }> | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current !== undefined && current !== null; depth += 1) {
    const parsed = pgErrorShape.safeParse(current);
    if (parsed.success && /^[0-9A-Z]{5}$/.test(parsed.data.code)) {
      return parsed.data.constraint === undefined
        ? { code: parsed.data.code }
        : { code: parsed.data.code, constraint: parsed.data.constraint };
    }
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}

export const PG = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  checkViolation: '23514',
  exclusionViolation: '23P01',
  serializationFailure: '40001',
  insufficientPrivilege: '42501',
} as const;
