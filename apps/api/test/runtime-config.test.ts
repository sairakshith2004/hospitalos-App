import { describe, expect, it } from 'vitest';

import {
  ConfigError,
  MIGRATION_TARGETS,
  isMigrationTarget,
  loadConfig,
  loadMigrationUrl,
} from '../src/config/env';

// Long enough to pass the 32-character password rule; never a real credential.
const SENTINEL = 'S3cr3tValueThatMustNeverAppearInAnyLogOrError';
const PEPPER = 'example-pepper-for-tests-only-not-a-real-secret';
const url = (database: string, user = 'hos_app') =>
  `postgres://${user}:${SENTINEL}@127.0.0.1:5433/${database}`;

const DEV = { DATABASE_URL: url('hospitalos_dev'), RESET_CODE_PEPPER: PEPPER };
const PROD = {
  NODE_ENV: 'production',
  DATABASE_URL: url('hospitalos_prod'),
  DATABASE_ALLOWED_NAMES: 'hospitalos_prod',
  RESET_CODE_PEPPER: PEPPER,
};
const TLS = { TLS_CERT_FILE: 'C:\\HospitalOS\\data\\certs\\server.crt', TLS_KEY_FILE: 'k.pem' };

function errorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError');
}

describe('W1 settings: defaults', () => {
  it('leaves web app, TLS, log file and control listener off unless configured', () => {
    const config = loadConfig(DEV);
    expect(config.WEB_ROOT).toBeUndefined();
    expect(config.TLS_CERT_FILE).toBeUndefined();
    expect(config.LOG_FILE).toBeUndefined();
    expect(config.CONTROL_PORT).toBeUndefined();
  });

  it('treats empty values as unset (Windows .env files often carry NAME=)', () => {
    const config = loadConfig({ ...DEV, WEB_ROOT: '  ', LOG_FILE: '', TLS_CERT_FILE: '' });
    expect(config.WEB_ROOT).toBeUndefined();
    expect(config.LOG_FILE).toBeUndefined();
  });

  it('accepts Windows paths with spaces as given', () => {
    const config = loadConfig({ ...DEV, WEB_ROOT: 'C:\\Program Files\\HospitalOS\\app\\web' });
    expect(config.WEB_ROOT).toBe('C:\\Program Files\\HospitalOS\\app\\web');
  });
});

describe('W1 settings: HTTPS', () => {
  it('requires the certificate and key together', () => {
    expect(errorOf(() => loadConfig({ ...DEV, TLS_CERT_FILE: 'c.pem' })).message).toContain(
      'set both or neither',
    );
    expect(errorOf(() => loadConfig({ ...DEV, TLS_KEY_FILE: 'k.pem' })).message).toContain(
      'set both or neither',
    );
    expect(loadConfig({ ...DEV, ...TLS }).TLS_KEY_FILE).toBe('k.pem');
  });

  it('refuses plain HTTP on a network address in production', () => {
    const error = errorOf(() => loadConfig({ ...PROD, HOST: '0.0.0.0' }));
    expect(error.message).toContain('requires HTTPS');
    expect(loadConfig({ ...PROD, HOST: '192.168.1.20', ...TLS }).HOST).toBe('192.168.1.20');
  });

  it('allows plain HTTP in production only on loopback (single-computer use)', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1']) {
      expect(loadConfig({ ...PROD, HOST: host }).HOST).toBe(host);
    }
  });
});

describe('W1 settings: database purpose', () => {
  it('production must use hospitalos_prod', () => {
    const error = errorOf(() =>
      loadConfig({
        ...PROD,
        DATABASE_URL: url('hospitalos_demo'),
        DATABASE_ALLOWED_NAMES: 'hospitalos_demo',
      }),
    );
    expect(error.message).toContain('production must use hospitalos_prod');
    expect(loadConfig(PROD).DATABASE_URL).toBe(url('hospitalos_prod'));
  });

  it('hospitalos_prod is refused outside production', () => {
    const error = errorOf(() => loadConfig({ ...PROD, NODE_ENV: 'development' }));
    expect(error.message).toContain('may only be used with NODE_ENV=production');
  });

  it('the demo database runs outside production', () => {
    const config = loadConfig({
      ...DEV,
      DATABASE_URL: url('hospitalos_demo'),
      DATABASE_ALLOWED_NAMES: 'hospitalos_demo',
    });
    expect(config.DATABASE_URL).toBe(url('hospitalos_demo'));
  });

  it('never echoes secret values in errors', () => {
    const error = errorOf(() => loadConfig({ ...PROD, HOST: '0.0.0.0', NODE_ENV: 'test' }));
    expect(error.message).not.toContain(SENTINEL);
  });
});

describe('W1 settings: control listener', () => {
  it('requires the port and token file together, on a different port', () => {
    expect(errorOf(() => loadConfig({ ...DEV, CONTROL_PORT: '4001' })).message).toContain(
      'CONTROL_PORT / CONTROL_TOKEN_FILE',
    );
    expect(
      errorOf(() => loadConfig({ ...DEV, CONTROL_PORT: '4000', CONTROL_TOKEN_FILE: 't' })).message,
    ).toContain('must differ from PORT');
    const config = loadConfig({ ...DEV, CONTROL_PORT: '4001', CONTROL_TOKEN_FILE: 'run/ctl' });
    expect(config.CONTROL_PORT).toBe(4001);
  });
});

describe('migration targets', () => {
  it('knows dev, test, demo and prod, and nothing else', () => {
    expect(['dev', 'test', 'demo', 'prod'].every((t) => isMigrationTarget(t))).toBe(true);
    expect(isMigrationTarget('hms')).toBe(false);
    expect(isMigrationTarget(undefined)).toBe(false);
    expect(MIGRATION_TARGETS.demo.database).toBe('hospitalos_demo');
    expect(MIGRATION_TARGETS.prod.database).toBe('hospitalos_prod');
  });

  it('checks the owner URL names the target database', () => {
    const owner = url('hospitalos_prod', 'hos_owner');
    expect(loadMigrationUrl('prod', { MIGRATION_DATABASE_URL: owner })).toBe(owner);
    expect(
      errorOf(() => loadMigrationUrl('demo', { MIGRATION_DATABASE_URL: owner })).message,
    ).toContain('must point at hospitalos_demo');
  });
});
