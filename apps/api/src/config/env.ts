import { readFileSync } from 'node:fs';

import { z } from 'zod';

/**
 * API configuration, validated once at start-up from the repository-root `.env`. Errors name the
 * setting and the problem, never the value, so secrets can't leak into logs or terminals.
 */
export class ConfigError extends Error {
  override name = 'ConfigError';
}

export type RawEnv = Readonly<Record<string, string | undefined>>;

/** Settings that hold secrets and may be given as NAME_FILE=/path instead of NAME=value. */
export const SECRET_SETTINGS = [
  'RESET_CODE_PEPPER',
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'TEST_DATABASE_URL',
  'TEST_MIGRATION_DATABASE_URL',
] as const;

export type SecretSetting = (typeof SECRET_SETTINGS)[number];

/** Database names that belong to the reference HospitalOS project. Always refused. */
export const REFERENCE_DATABASE_PREFIX = 'hms_';

/** Passwords inside connection strings must be at least this long (env:init makes 64). */
export const MIN_DATABASE_PASSWORD_LENGTH = 32;

const PLACEHOLDER = /change-me|placeholder|<[^>]*>/i;
const DATABASE_NAME = /^hospitalos_[a-z0-9_]+$/;

/** The database name in a postgres:// URL, or undefined when the URL can't be read. */
export function databaseNameOf(url: string): string | undefined {
  try {
    const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    return name.length > 0 ? name : undefined;
  } catch {
    return undefined;
  }
}

function passwordOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).password);
  } catch {
    return '';
  }
}

const postgresUrl = z
  .string()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'postgres:' || url.protocol === 'postgresql:';
    } catch {
      return false;
    }
  }, 'must be a postgres:// connection string')
  .refine((value) => !PLACEHOLDER.test(value), 'still contains a placeholder value')
  .refine(
    (value) => passwordOf(value).length >= MIN_DATABASE_PASSWORD_LENGTH,
    `the password must be at least ${MIN_DATABASE_PASSWORD_LENGTH} characters (run npm run env:init)`,
  )
  .refine(
    (value) => !(databaseNameOf(value) ?? '').startsWith(REFERENCE_DATABASE_PREFIX),
    'points at a reference HospitalOS database (hms_*), which is never allowed',
  )
  .refine(
    (value) => DATABASE_NAME.test(databaseNameOf(value) ?? ''),
    'must name a hospitalos_* database',
  );

const nameList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  )
  .refine((names) => names.length > 0, 'must list at least one database name')
  .refine(
    (names) => names.every((name) => DATABASE_NAME.test(name)),
    'may only contain hospitalos_* database names',
  );

const apiSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: postgresUrl,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_ALLOWED_NAMES: nameList.default(['hospitalos_dev']),
  TEST_DATABASE_URL: postgresUrl.optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(300),
  /** Key for the reset-code HMAC (architecture §5.4). Random, at least 32 characters. */
  RESET_CODE_PEPPER: z
    .string()
    .min(
      MIN_DATABASE_PASSWORD_LENGTH,
      `must be at least ${MIN_DATABASE_PASSWORD_LENGTH} random characters (run npm run env:init -- --add-missing)`,
    )
    .refine((value) => !PLACEHOLDER.test(value), 'still contains a placeholder value'),
  /** Local email catcher (Mailpit). Unset: reset codes can't be emailed (logged as not sent). */
  SMTP_HOST: z.enum(['127.0.0.1', 'localhost', '::1']).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1026),
  MAIL_FROM: z.email().default('no-reply@hospitalos.invalid'),
  /** Browser origins allowed by CORS (the Expo web build in development). Empty: no CORS. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
    .refine(
      (list) => list.every((o) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o)),
      'must be a comma-separated list of origins',
    ),
  /** Express trust proxy. Off unless the API runs behind a known proxy (R9). */
  TRUST_PROXY: z.enum(['false', 'loopback']).default('false'),
});

export type ApiConfig = z.infer<typeof apiSchema>;

/** Replaces NAME_FILE settings with the file's contents; both forms together is an error. */
export function resolveFileSecrets(raw: RawEnv): Record<string, string | undefined> {
  const resolved: Record<string, string | undefined> = { ...raw };
  for (const name of SECRET_SETTINGS) {
    const filePath = raw[`${name}_FILE`];
    if (filePath === undefined || filePath === '') continue;
    if (raw[name] !== undefined && raw[name] !== '') {
      throw new ConfigError(`${name}: set either ${name} or ${name}_FILE, not both.`);
    }
    try {
      resolved[name] = readFileSync(filePath, 'utf8').trim();
    } catch {
      throw new ConfigError(`${name}_FILE: the file could not be read.`);
    }
  }
  return resolved;
}

function describeIssues(issues: readonly z.core.$ZodIssue[]): string {
  return issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n');
}

/** Loads and validates the API settings. Throws ConfigError naming each bad setting. */
export function loadConfig(raw: RawEnv): ApiConfig {
  const env = resolveFileSecrets(raw);
  const parsed = apiSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(`Invalid API configuration:\n${describeIssues(parsed.error.issues)}`);
  }
  const config = parsed.data;
  const problems: string[] = [];

  const database = databaseNameOf(config.DATABASE_URL) ?? '';
  if (!config.DATABASE_ALLOWED_NAMES.includes(database)) {
    problems.push('DATABASE_URL: its database is not listed in DATABASE_ALLOWED_NAMES');
  }
  if (database === 'hospitalos_test' && config.NODE_ENV !== 'test') {
    problems.push('DATABASE_URL: the test database may only be used with NODE_ENV=test');
  }
  if (config.TEST_DATABASE_URL !== undefined) {
    if (databaseNameOf(config.TEST_DATABASE_URL) !== 'hospitalos_test') {
      problems.push('TEST_DATABASE_URL: must point at hospitalos_test');
    }
    if (config.TEST_DATABASE_URL === config.DATABASE_URL) {
      problems.push('TEST_DATABASE_URL: must differ from DATABASE_URL');
    }
  }
  if (config.NODE_ENV === 'production') {
    if ((env.DATABASE_ALLOWED_NAMES ?? '') === '') {
      problems.push('DATABASE_ALLOWED_NAMES: must be set explicitly in production');
    }
    if (config.DATABASE_ALLOWED_NAMES.includes('hospitalos_test')) {
      problems.push('DATABASE_ALLOWED_NAMES: the test database is not allowed in production');
    }
  }
  if (problems.length > 0) {
    throw new ConfigError(`Invalid API configuration:\n${problems.join('\n')}`);
  }
  return config;
}

export type MigrationTarget = 'dev' | 'test';

/** The database each migration target may touch, and the setting that holds its URL. */
export const MIGRATION_TARGETS: Readonly<
  Record<MigrationTarget, { setting: SecretSetting; database: string }>
> = {
  dev: { setting: 'MIGRATION_DATABASE_URL', database: 'hospitalos_dev' },
  test: { setting: 'TEST_MIGRATION_DATABASE_URL', database: 'hospitalos_test' },
};

/** Loads the owner connection string for a migration target and checks it names that database. */
export function loadMigrationUrl(target: MigrationTarget, raw: RawEnv): string {
  const env = resolveFileSecrets(raw);
  const { setting, database } = MIGRATION_TARGETS[target];
  const parsed = postgresUrl.safeParse(env[setting]);
  if (!parsed.success) {
    throw new ConfigError(
      `Invalid migration configuration:\n${setting}: ${parsed.error.issues[0]?.message ?? 'is required'}`,
    );
  }
  if (databaseNameOf(parsed.data) !== database) {
    throw new ConfigError(
      `Invalid migration configuration:\n${setting}: must point at ${database}`,
    );
  }
  return parsed.data;
}

/** Settings checked by `npm run db:env:check`; names only are reported. */
export function checkAllSettings(raw: RawEnv): string[] {
  const report: string[] = [];
  loadConfig(raw);
  report.push('API settings (DATABASE_URL and friends): ok');
  for (const target of ['dev', 'test'] as const) {
    loadMigrationUrl(target, raw);
    report.push(`${MIGRATION_TARGETS[target].setting}: ok`);
  }
  const env = resolveFileSecrets(raw);
  if (env.TEST_DATABASE_URL === undefined) {
    throw new ConfigError('TEST_DATABASE_URL: is required for database tests');
  }
  for (const name of ['POSTGRES_PASSWORD', 'HOS_OWNER_PASSWORD', 'HOS_APP_PASSWORD'] as const) {
    const value = env[name] ?? '';
    if (value.length < MIN_DATABASE_PASSWORD_LENGTH || PLACEHOLDER.test(value)) {
      throw new ConfigError(
        `${name}: must be at least ${MIN_DATABASE_PASSWORD_LENGTH} random characters (run npm run env:init)`,
      );
    }
    report.push(`${name}: ok`);
  }
  return report;
}
