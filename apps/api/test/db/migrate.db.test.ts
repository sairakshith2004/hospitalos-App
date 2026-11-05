import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { MigrationError, loadMigrations, runMigrations } from '../../src/db/migrate';

import { appPool, ownerPool } from './support';

const MIGRATIONS = fileURLToPath(new URL('../../src/db/migrations', import.meta.url));
const owner = ownerPool();
const app = appPool();

afterAll(async () => {
  await Promise.all([owner.end(), app.end()]);
});

describe('migrations on hospitalos_test', () => {
  it('are idempotent: a second run applies nothing', async () => {
    await runMigrations(owner, loadMigrations(MIGRATIONS));
    const second = await runMigrations(owner, loadMigrations(MIGRATIONS));
    expect(second.applied).toEqual([]);
    expect(second.skipped).toContain('0000_extensions.sql');
  });

  it('leave the four extensions installed', async () => {
    const { rows } = await owner.query<{ extname: string }>(
      "select extname from pg_extension where extname in ('pgcrypto','citext','pg_trgm','btree_gist') order by extname",
    );
    expect(rows.map((r) => r.extname)).toEqual(['btree_gist', 'citext', 'pg_trgm', 'pgcrypto']);
  });

  it('refuse an applied migration whose content was changed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hos-mig-tampered-'));
    writeFileSync(join(dir, '0000_extensions.sql'), '-- edited after it was applied\nselect 1;\n');
    await expect(runMigrations(owner, loadMigrations(dir))).rejects.toBeInstanceOf(MigrationError);
  });

  it('keep the migration history away from the application user', async () => {
    await expect(app.query('select * from schema_migrations')).rejects.toThrow(/permission denied/);
  });
});
