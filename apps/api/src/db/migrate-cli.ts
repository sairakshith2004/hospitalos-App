import { fileURLToPath } from 'node:url';

import {
  ConfigError,
  MIGRATION_TARGETS,
  loadMigrationUrl,
  type MigrationTarget,
} from '../config/env';
import { createLogger } from '../lib/logger';

import { createPool } from './client';
import { verifyDatabaseIdentity } from './guards';
import { loadMigrations, runMigrations } from './migrate';

/**
 * `npm run db:migrate` (target dev) and `npm run db:migrate:test` (target test).
 * Connects as hos_owner, verifies the database identity, then applies pending migrations.
 */
const logger = createLogger('info');
const target = process.argv[2];

function isTarget(value: string | undefined): value is MigrationTarget {
  return value === 'dev' || value === 'test';
}

if (!isTarget(target)) {
  logger.error('usage: migrate-cli.ts dev|test');
  process.exit(2);
}

const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));

let url: string;
try {
  url = loadMigrationUrl(target, process.env);
} catch (error) {
  logger.error(error instanceof ConfigError ? error.message : 'Invalid migration configuration.');
  process.exit(1);
}

const pool = createPool(url, 1);
try {
  await verifyDatabaseIdentity(pool, {
    expectedUser: 'hos_owner',
    allowedDatabases: [MIGRATION_TARGETS[target].database],
  });
  const result = await runMigrations(pool, loadMigrations(migrationsDir));
  logger.info({ target, applied: result.applied, skipped: result.skipped }, 'migrations finished');
} catch (error) {
  logger.error(
    { target, reason: error instanceof Error ? error.message : 'unknown' },
    'migration failed',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
