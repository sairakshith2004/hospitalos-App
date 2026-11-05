import { createPool } from '../../src/db/client';

/** The test database as the application user (least privilege). */
export function appPool() {
  return createPool(requireEnv('TEST_DATABASE_URL'), 2);
}

/** The test database as the owner (migrations only). */
export function ownerPool() {
  return createPool(requireEnv('TEST_MIGRATION_DATABASE_URL'), 2);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  if (!new URL(value).pathname.endsWith('/hospitalos_test')) {
    throw new Error(`${name} must point at hospitalos_test`);
  }
  return value;
}
