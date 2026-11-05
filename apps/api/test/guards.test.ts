import { describe, expect, it } from 'vitest';

import {
  DatabaseIdentityError,
  identityProblems,
  verifyDatabaseIdentity,
  type DatabaseIdentity,
} from '../src/db/guards';

const SAFE: DatabaseIdentity = {
  database: 'hospitalos_dev',
  user: 'hos_app',
  superuser: false,
  createRole: false,
  createDb: false,
  replication: false,
  bypassRls: false,
};

const EXPECT = { expectedUser: 'hos_app', allowedDatabases: ['hospitalos_dev', 'hospitalos_test'] };

describe('identityProblems', () => {
  it('accepts the expected least-privilege identity', () => {
    expect(identityProblems(SAFE, EXPECT)).toEqual([]);
  });

  it("refuses the reference project's databases and users (ISO-2)", () => {
    expect(identityProblems({ ...SAFE, database: 'hms_dev' }, EXPECT)).toEqual([
      'database "hms_dev" is not in the allowed list',
    ]);
    expect(identityProblems({ ...SAFE, user: 'hms_app' }, EXPECT)).toEqual([
      'connected as "hms_app", expected "hos_app"',
    ]);
  });

  it('refuses over-privileged users', () => {
    const problems = identityProblems(
      {
        ...SAFE,
        superuser: true,
        createRole: true,
        createDb: true,
        replication: true,
        bypassRls: true,
      },
      EXPECT,
    );
    expect(problems).toHaveLength(5);
  });
});

describe('verifyDatabaseIdentity', () => {
  const fake = (row: Record<string, unknown>) => ({
    query: () => Promise.resolve({ rows: [row] }),
  });
  const row = {
    database: 'hospitalos_dev',
    user: 'hos_app',
    superuser: false,
    create_role: false,
    create_db: false,
    replication: false,
    bypass_rls: false,
  };

  it('returns the identity when it is acceptable', async () => {
    await expect(verifyDatabaseIdentity(fake(row), EXPECT)).resolves.toMatchObject({
      database: 'hospitalos_dev',
    });
  });

  it('throws DatabaseIdentityError otherwise', async () => {
    await expect(
      verifyDatabaseIdentity(fake({ ...row, database: 'hms_dev', superuser: true }), EXPECT),
    ).rejects.toBeInstanceOf(DatabaseIdentityError);
  });
});
