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

  it('record exactly the shipped migrations, with their checksums', async () => {
    const shipped = loadMigrations(MIGRATIONS);
    const { rows } = await owner.query<{ name: string; checksum: string }>(
      'select name, checksum from schema_migrations order by name',
    );
    expect(rows).toEqual(shipped.map(({ name, checksum }) => ({ name, checksum })));
  });

  it('let the application user read the migration history but never change it', async () => {
    const { rows } = await app.query('select name from schema_migrations');
    expect(rows.length).toBeGreaterThan(0);
    for (const statement of [
      "insert into schema_migrations (name, checksum) values ('9999_probe.sql', 'x')",
      "update schema_migrations set checksum = 'x'",
      'delete from schema_migrations',
      'truncate schema_migrations',
      'drop table schema_migrations',
      'alter table schema_migrations add column probe int',
    ]) {
      await expect(app.query(statement), statement).rejects.toThrow(
        /permission denied|must be owner/,
      );
    }
  });

  it('set the schema metadata comment', async () => {
    const { rows } = await owner.query<{ comment: string | null }>(
      "select obj_description('public'::regnamespace, 'pg_namespace') as comment",
    );
    expect(rows[0]?.comment).toMatch(/^HospitalOS Mobile application schema/);
  });
});
