import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

import { DatabaseIdentityError, verifyDatabaseIdentity } from '../../src/db/guards';

import { appPool, ownerPool } from './support';

const app = appPool();
const owner = ownerPool();

afterAll(async () => {
  await Promise.all([app.end(), owner.end()]);
});

describe('database identity guard on hospitalos_test', () => {
  it('accepts hos_app on an allowed database and reports least privilege', async () => {
    const identity = await verifyDatabaseIdentity(app, {
      expectedUser: 'hos_app',
      allowedDatabases: ['hospitalos_test'],
    });
    expect(identity).toEqual({
      database: 'hospitalos_test',
      user: 'hos_app',
      superuser: false,
      createRole: false,
      createDb: false,
      replication: false,
      bypassRls: false,
    });
  });

  it('refuses the same connection when its database is not allowed', async () => {
    await expect(
      verifyDatabaseIdentity(app, {
        expectedUser: 'hos_app',
        allowedDatabases: ['hospitalos_dev'],
      }),
    ).rejects.toBeInstanceOf(DatabaseIdentityError);
  });

  it('refuses the owner where the application user is expected', async () => {
    await expect(
      verifyDatabaseIdentity(owner, {
        expectedUser: 'hos_app',
        allowedDatabases: ['hospitalos_test'],
      }),
    ).rejects.toBeInstanceOf(DatabaseIdentityError);
  });

  it('gives hos_app no right to create objects in the public schema', async () => {
    await expect(app.query('create table hos_app_probe (id int)')).rejects.toThrow(
      /permission denied/,
    );
  });

  it('stops hos_app from connecting to the maintenance database', async () => {
    const url = new URL(process.env.TEST_DATABASE_URL ?? '');
    url.pathname = '/postgres';
    const client = new pg.Client({ connectionString: url.toString() });
    await expect(client.connect()).rejects.toThrow(/permission denied/);
    await client.end().catch(() => undefined);
  });
});
