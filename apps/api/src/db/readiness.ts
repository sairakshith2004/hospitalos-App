import { z } from 'zod';

import { verifyDatabaseIdentity, type IdentityExpectations, type Queryable } from './guards';
import type { Migration } from './migrate';

/** The database is reachable but its migration state is not what this API build expects. */
export class MigrationStateError extends Error {
  override name = 'MigrationStateError';
}

const recordedRow = z.object({ name: z.string(), checksum: z.string() });

/**
 * Readiness: the connection passes the identity guard, and the database has applied exactly the
 * migrations this build ships (same names, same checksums, nothing missing or unknown).
 * The application user may read `schema_migrations` but never change it.
 */
export async function checkDatabaseReadiness(
  db: Queryable,
  expectations: IdentityExpectations,
  expected: readonly Migration[],
): Promise<void> {
  await verifyDatabaseIdentity(db, expectations);
  const { rows } = await db.query('select name, checksum from schema_migrations order by name');
  const recorded = rows.map((row) => recordedRow.parse(row));
  const same =
    recorded.length === expected.length &&
    recorded.every(
      (row, i) => row.name === expected[i]?.name && row.checksum === expected[i]?.checksum,
    );
  if (!same) {
    throw new MigrationStateError(
      `expected migrations [${expected.map((m) => m.name).join(', ')}], found [${recorded
        .map((r) => r.name)
        .join(', ')}]`,
    );
  }
}
