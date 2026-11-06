import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

// `date` columns (birth dates, visit dates, expiry) stay plain `YYYY-MM-DD` strings: converting
// them to JavaScript Dates would shift them by the server's time zone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/** Called when an idle pooled connection fails (for example, the database restarted). */
export type PoolErrorHandler = (error: Error & { code?: string }) => void;

/**
 * A PostgreSQL pool for the API or a migration run. The URL is never logged.
 *
 * pg emits 'error' when the server closes a connection the pool is holding idle. Without a
 * listener Node treats that as fatal and the whole process exits, so a database restart would take
 * the API down instead of making /api/ready answer 503. The pool drops the broken connection and
 * opens a new one on the next query.
 */
export function createPool(
  connectionString: string,
  max = 10,
  onIdleError: PoolErrorHandler = () => undefined,
): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max,
    application_name: 'hospitalos-api',
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  });
  pool.on('error', onIdleError);
  return pool;
}

/** Drizzle on top of the pool. Tables are added to src/db/schema from phase 1.2. */
export function createDb(pool: pg.Pool): NodePgDatabase {
  return drizzle(pool);
}
