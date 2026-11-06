import {
  ConfigError,
  MIGRATION_TARGETS,
  loadMigrationUrl,
  type MigrationTarget,
} from '../config/env';
import { createPool } from '../db/client';
import { verifyDatabaseIdentity } from '../db/guards';
import { createDatabase, type Db } from '../db/sql';

/**
 * Operator commands connect as hos_owner to one named database (dev or test), after the same
 * identity guard as migrations. They never reach any other database.
 */
export async function openOwnerDatabase(
  target: string | undefined,
): Promise<{ db: Db; close: () => Promise<void>; target: MigrationTarget }> {
  if (target !== 'dev' && target !== 'test') {
    throw new ConfigError('usage: <command> dev|test');
  }
  const pool = createPool(loadMigrationUrl(target, process.env), 2);
  try {
    await verifyDatabaseIdentity(pool, {
      expectedUser: 'hos_owner',
      allowedDatabases: [MIGRATION_TARGETS[target].database],
    });
  } catch (error) {
    await pool.end();
    throw error;
  }
  return { db: createDatabase(pool), close: () => pool.end(), target };
}

export function fail(error: unknown): never {
  process.stderr.write(`${error instanceof Error ? error.message : 'failed'}\n`);
  process.exit(1);
}
