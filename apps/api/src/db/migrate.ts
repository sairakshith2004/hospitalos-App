import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type pg from 'pg';
import { z } from 'zod';

/**
 * Forward-only migration runner. Each `NNNN_name.sql` file runs once, in order, inside its own
 * transaction, and is recorded in `schema_migrations` with a SHA-256 checksum. An applied file
 * that has been edited is refused: corrections are always a new migration.
 */
export class MigrationError extends Error {
  override name = 'MigrationError';
}

export type Migration = Readonly<{ name: string; sql: string; checksum: string }>;

export const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

/** Advisory lock key so two migration runs can never overlap. */
const MIGRATION_LOCK_KEY = 40_005_433;

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

/** Reads the migration files in order. Any other file in the folder is an error. */
export function loadMigrations(directory: string): Migration[] {
  const files = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
  const invalid = files.filter((name) => !MIGRATION_FILE.test(name));
  if (invalid.length > 0) {
    throw new MigrationError(`Unexpected migration file names: ${invalid.join(', ')}`);
  }
  return files.map((name) => {
    const sql = readFileSync(join(directory, name), 'utf8');
    return { name, sql, checksum: checksumOf(sql) };
  });
}

const appliedRow = z.object({ name: z.string(), checksum: z.string() });

export type MigrationResult = Readonly<{ applied: string[]; skipped: string[] }>;

export async function runMigrations(
  pool: pg.Pool,
  migrations: readonly Migration[],
): Promise<MigrationResult> {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    await client.query(`create table if not exists schema_migrations (
      id integer generated always as identity primary key,
      name text not null unique,
      checksum text not null,
      applied_at timestamptz not null default now()
    )`);
    // The application user may only READ the migration history (readiness check); it can never
    // change it.
    await client.query(`do $$ begin
      if exists (select 1 from pg_roles where rolname = 'hos_app') then
        revoke all on schema_migrations from hos_app;
        grant select on schema_migrations to hos_app;
      end if;
    end $$`);
    await client.query('revoke all on schema_migrations from public');

    const { rows } = await client.query('select name, checksum from schema_migrations');
    const applied = new Map(
      rows.map((row) => appliedRow.parse(row)).map((r) => [r.name, r.checksum]),
    );

    const result: { applied: string[]; skipped: string[] } = { applied: [], skipped: [] };
    for (const migration of migrations) {
      const recorded = applied.get(migration.name);
      if (recorded !== undefined) {
        if (recorded !== migration.checksum) {
          throw new MigrationError(
            `${migration.name} was changed after it was applied. Add a new migration instead.`,
          );
        }
        result.skipped.push(migration.name);
        continue;
      }
      await client.query('begin');
      try {
        await client.query(migration.sql);
        await client.query('insert into schema_migrations (name, checksum) values ($1, $2)', [
          migration.name,
          migration.checksum,
        ]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
      result.applied.push(migration.name);
    }
    return result;
  } finally {
    await client
      .query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY])
      .catch(() => undefined);
    client.release();
  }
}
