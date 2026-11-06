import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig, loadMigrationUrl } from '../src/config/env';

// Long enough to pass the 32-character password rule; never a real credential.
const SENTINEL = 'S3cr3tValueThatMustNeverAppearInAnyLogOrError';
const PEPPER = 'example-pepper-for-tests-only-not-a-real-secret';
const VALID = {
  DATABASE_URL: `postgres://hos_app:${SENTINEL}@127.0.0.1:5433/hospitalos_dev`,
  RESET_CODE_PEPPER: PEPPER,
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
      DATABASE_ALLOWED_NAMES: ['hospitalos_dev'],
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

  it('refuses short database passwords without printing them', () => {
    const short = 'short1234';
    const error = errorOf(() =>
      loadConfig({ DATABASE_URL: `postgres://hos_app:${short}@127.0.0.1:5433/hospitalos_dev` }),
    );
    expect(error.message).toContain('at least 32 characters');
    expect(error.message).not.toContain(short);
  });

  it('refuses reference (hms_*) databases', () => {
    const error = errorOf(() =>
      loadConfig({ DATABASE_URL: `postgres://hos_app:${SENTINEL}@127.0.0.1:5433/hms_dev` }),
    );
    expect(error.message).toContain('hms_');
    expect(error.message).not.toContain(SENTINEL);
  });

  it('allows the test database only with NODE_ENV=test', () => {
    const url = `postgres://hos_app:${SENTINEL}@127.0.0.1:5433/hospitalos_test`;
    const allow = {
      DATABASE_URL: url,
      DATABASE_ALLOWED_NAMES: 'hospitalos_test',
      RESET_CODE_PEPPER: PEPPER,
    };
    expect(errorOf(() => loadConfig(allow)).message).toContain('NODE_ENV=test');
    expect(loadConfig({ ...allow, NODE_ENV: 'test' }).DATABASE_URL).toBe(url);
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
    expect(loadConfig({ DATABASE_URL_FILE: file, RESET_CODE_PEPPER: PEPPER }).DATABASE_URL).toBe(
      VALID.DATABASE_URL,
    );
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

describe('RESET_CODE_PEPPER', () => {
  it('is required, long and never a placeholder', () => {
    expect(errorOf(() => loadConfig({ DATABASE_URL: VALID.DATABASE_URL })).message).toContain(
      'RESET_CODE_PEPPER',
    );
    expect(errorOf(() => loadConfig({ ...VALID, RESET_CODE_PEPPER: 'short' })).message).toContain(
      'RESET_CODE_PEPPER',
    );
    expect(
      errorOf(() =>
        loadConfig({ ...VALID, RESET_CODE_PEPPER: 'change-me-change-me-change-me-change-me' }),
      ).message,
    ).toContain('placeholder');
  });

  it('accepts only a loopback SMTP host', () => {
    expect(loadConfig({ ...VALID, SMTP_HOST: '127.0.0.1' }).SMTP_HOST).toBe('127.0.0.1');
    expect(
      errorOf(() => loadConfig({ ...VALID, SMTP_HOST: 'smtp.example.com' })).message,
    ).toContain('SMTP_HOST');
  });
});
