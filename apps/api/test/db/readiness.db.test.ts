import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { DatabaseIdentityError } from '../../src/db/guards';
import { loadMigrations } from '../../src/db/migrate';
import { MigrationStateError, checkDatabaseReadiness } from '../../src/db/readiness';

import { appPool, ownerPool } from './support';

const shipped = loadMigrations(fileURLToPath(new URL('../../src/db/migrations', import.meta.url)));
const expectations = { expectedUser: 'hos_app', allowedDatabases: ['hospitalos_test'] };
const app = appPool();
const owner = ownerPool();

afterAll(async () => {
  await Promise.all([app.end(), owner.end()]);
});

describe('readiness on hospitalos_test', () => {
  it('passes as hos_app with exactly the shipped migrations', async () => {
    await expect(checkDatabaseReadiness(app, expectations, shipped)).resolves.toBeUndefined();
  });

  it('fails when this build expects a migration the database lacks', async () => {
    const extra = [...shipped, { name: '0001_future.sql', sql: '', checksum: 'x' }];
    await expect(checkDatabaseReadiness(app, expectations, extra)).rejects.toBeInstanceOf(
      MigrationStateError,
    );
  });

  it('fails when a recorded checksum differs from the shipped file', async () => {
    const changed = shipped.map((m) => ({ ...m, checksum: '0'.repeat(64) }));
    await expect(checkDatabaseReadiness(app, expectations, changed)).rejects.toBeInstanceOf(
      MigrationStateError,
    );
  });

  it('fails for the owner connection (identity guard runs first)', async () => {
    await expect(checkDatabaseReadiness(owner, expectations, shipped)).rejects.toBeInstanceOf(
      DatabaseIdentityError,
    );
  });
});

describe('least privilege for hos_app', () => {
  it('cannot create extensions, schemas or functions', async () => {
    for (const statement of [
      'create extension if not exists hstore',
      'create schema hos_app_probe',
      'create function hos_app_probe() returns int language sql as $$ select 1 $$',
    ]) {
      await expect(app.query(statement), statement).rejects.toThrow(/permission denied/);
    }
  });

  it('cannot change roles or reach another database in the same session', async () => {
    await expect(app.query('alter role hos_app superuser')).rejects.toThrow(/permission denied/);
    await expect(app.query('create database hos_app_probe')).rejects.toThrow(/permission denied/);
  });
});
