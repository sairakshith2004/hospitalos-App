import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/** A PostgreSQL pool for the API or a migration run. The URL is never logged. */
export function createPool(connectionString: string, max = 10): pg.Pool {
  return new pg.Pool({
    connectionString,
    max,
    application_name: 'hospitalos-api',
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 15_000,
  });
}

/** Drizzle on top of the pool. Tables are added to src/db/schema from phase 1.2. */
export function createDb(pool: pg.Pool): NodePgDatabase {
  return drizzle(pool);
}
