import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig, loadMigrationUrl } from '../src/config/env';

const SENTINEL = 'S3cr3tValueThatMustNeverAppear';
const VALID = {
  DATABASE_URL: `postgres://hos_app:${SENTINEL}@127.0.0.1:5433/hospitalos_dev`,
};

function errorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError');
}

describe('loadConfig', () => {
  it('applies safe defaults', () => {
    const config = loadConfig(VALID);
    expect(config).toMatchObject({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 4000,
      LOG_LEVEL: 'info',
      DATABASE_POOL_MAX: 10,
      DATABASE_ALLOWED_NAMES: ['hospitalos_dev', 'hospitalos_test'],
    });
  });

  it('requires DATABASE_URL and names it', () => {
    expect(errorOf(() => loadConfig({})).message).toContain('DATABASE_URL');
  });

  it('refuses placeholder values without printing them', () => {
    const error = errorOf(() =>
      loadConfig({ DATABASE_URL: 'postgres://hos_app:change-me@127.0.0.1:5433/hospitalos_dev' }),
    );
    expect(error.message).toContain('DATABASE_URL');
    expect(error.message).toContain('placeholder');
    expect(error.message).not.toContain('change-me');
  });

  it('never includes a secret value in its error messages', () => {
    const error = errorOf(() => loadConfig({ ...VALID, PORT: 'not-a-port' }));
    expect(error.message).toContain('PORT');
    expect(error.message).not.toContain(SENTINEL);
  });

  it('refuses non-postgres URLs', () => {
    expect(errorOf(() => loadConfig({ DATABASE_URL: 'mysql://x@y/z' })).message).toContain(
      'postgres://',
    );
  });

  it('accepts only hospitalos_* database names in the allow-list', () => {
    expect(
      errorOf(() => loadConfig({ ...VALID, DATABASE_ALLOWED_NAMES: 'hospitalos_dev,hms_dev' }))
        .message,
    ).toContain('DATABASE_ALLOWED_NAMES');
  });

  it('requires an explicit allow-list without the test database in production', () => {
    expect(errorOf(() => loadConfig({ ...VALID, NODE_ENV: 'production' })).message).toContain(
      'DATABASE_ALLOWED_NAMES',
    );
    expect(
      errorOf(() =>
        loadConfig({
          ...VALID,
          NODE_ENV: 'production',
          DATABASE_ALLOWED_NAMES: 'hospitalos_prod,hospitalos_test',
        }),
      ).message,
    ).toContain('test database');
  });

  it('reads secrets from NAME_FILE and refuses both forms together', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hos-env-'));
    const file = join(dir, 'database_url');
    writeFileSync(file, `${VALID.DATABASE_URL}\n`);
    expect(loadConfig({ DATABASE_URL_FILE: file }).DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(
      errorOf(() => loadConfig({ DATABASE_URL_FILE: file, DATABASE_URL: VALID.DATABASE_URL }))
        .message,
    ).toContain('not both');
    expect(
      errorOf(() => loadConfig({ DATABASE_URL_FILE: join(dir, 'missing') })).message,
    ).toContain('could not be read');
  });
});

describe('loadMigrationUrl', () => {
  it('reads the owner URL for each target and names a missing one', () => {
    const url = `postgres://hos_owner:${SENTINEL}@127.0.0.1:5433/hospitalos_test`;
    expect(loadMigrationUrl('test', { TEST_MIGRATION_DATABASE_URL: url })).toBe(url);
    const error = errorOf(() => loadMigrationUrl('dev', {}));
    expect(error.message).toContain('MIGRATION_DATABASE_URL');
  });
});
