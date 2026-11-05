import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MigrationError, checksumOf, loadMigrations } from '../src/db/migrate';

const MIGRATIONS = fileURLToPath(new URL('../src/db/migrations', import.meta.url));

describe('loadMigrations', () => {
  it('loads the real migrations in order with stable checksums', () => {
    const migrations = loadMigrations(MIGRATIONS);
    expect(migrations.map((m) => m.name)).toEqual(['0000_extensions.sql']);
    const [first] = migrations;
    expect(first?.checksum).toBe(checksumOf(first?.sql ?? ''));
    expect(first?.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('migration 0000 only enables extensions (no tables, no data)', () => {
    const sql = loadMigrations(MIGRATIONS)[0]?.sql.toLowerCase() ?? '';
    expect(sql).not.toMatch(/create table|insert |update |delete |drop /);
    for (const ext of ['pgcrypto', 'citext', 'pg_trgm', 'btree_gist']) {
      expect(sql).toContain(`create extension if not exists ${ext}`);
    }
  });

  it('sorts by number and refuses unexpected file names', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hos-mig-'));
    writeFileSync(join(dir, '0002_b.sql'), 'select 2;');
    writeFileSync(join(dir, '0001_a.sql'), 'select 1;');
    expect(loadMigrations(dir).map((m) => m.name)).toEqual(['0001_a.sql', '0002_b.sql']);
    writeFileSync(join(dir, 'oops.sql'), 'select 3;');
    expect(() => loadMigrations(dir)).toThrow(MigrationError);
  });
});
