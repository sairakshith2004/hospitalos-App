import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createPool } from '../../src/db/client';
import { createDatabase } from '../../src/db/sql';
import { seedCatalogue } from '../../src/seed/catalogue';
import { seedAccessModel, seedBaseDepartments } from '../../src/seed/reference';

/**
 * Runs once before the database tests: seeds the reference access model into hospitalos_test
 * (idempotent), as `npm run db:seed:test` would. Migrations are applied beforehand by
 * `npm run db:migrate:test`.
 */
export default async function setup(): Promise<void> {
  const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.TEST_MIGRATION_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('/hospitalos_test')) {
    throw new Error('TEST_MIGRATION_DATABASE_URL must point at hospitalos_test');
  }
  const pool = createPool(url, 1);
  try {
    const db = createDatabase(pool);
    await seedAccessModel(db);
    await seedBaseDepartments(db);
    await seedCatalogue(db, 'test');
  } finally {
    await pool.end();
  }
}
