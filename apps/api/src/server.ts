import { fileURLToPath } from 'node:url';

import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { createApp } from './app';
import { ConfigError, loadConfig, type ApiConfig } from './config/env';
import { createPool } from './db/client';
import { verifyDatabaseIdentity } from './db/guards';
import { loadMigrations } from './db/migrate';
import { checkAccessCatalogue, checkDatabaseReadiness } from './db/readiness';
import { createDatabase, one } from './db/sql';
import { createLogger } from './lib/logger';
import { captureMailer, localSmtpMailer } from './mail/mailer';
import { authenticate } from './middleware/authenticate';
import { buildApi } from './modules/api';
import { createSettingsProvider } from './settings';

/**
 * Entry point. Refuses to start with invalid settings or a database connection that fails the
 * identity guard (wrong database, wrong user or an over-privileged user). Readiness additionally
 * requires exactly the migrations this build ships.
 */
let config: ApiConfig;
try {
  config = loadConfig(process.env);
} catch (error) {
  process.stderr.write(
    `${error instanceof ConfigError ? error.message : 'Invalid configuration.'}\n`,
  );
  process.exit(1);
}

const logger = createLogger(config.LOG_LEVEL);
const pool = createPool(config.DATABASE_URL, config.DATABASE_POOL_MAX, (error) => {
  // Only the PostgreSQL error code: messages can echo connection details.
  logger.warn({ pgErrorCode: error.code ?? 'unknown' }, 'idle database connection lost');
});
const expectations = { expectedUser: 'hos_app', allowedDatabases: config.DATABASE_ALLOWED_NAMES };
const expectedMigrations = loadMigrations(
  fileURLToPath(new URL('./db/migrations', import.meta.url)),
);

try {
  const identity = await verifyDatabaseIdentity(pool, expectations);
  logger.info({ database: identity.database, user: identity.user }, 'database identity verified');
} catch (error) {
  logger.fatal({ reason: error instanceof Error ? error.message : 'unknown' }, 'refusing to start');
  await pool.end();
  process.exit(1);
}

const db = createDatabase(pool);

// Demo accounts must never exist where real people sign in (ACC-5).
if (config.NODE_ENV === 'production') {
  const demo = await one(
    db,
    sql`select count(*)::int as n from users where is_demo`,
    z.object({ n: z.number() }),
  );
  if (demo.n > 0) {
    logger.fatal('refusing to start: demo accounts exist in a production database');
    await pool.end();
    process.exit(1);
  }
}

const settings = createSettingsProvider(db);
if (config.SMTP_HOST === undefined) {
  logger.warn('SMTP_HOST is not set: password-reset codes cannot be emailed');
}
const mailer =
  config.SMTP_HOST === undefined
    ? captureMailer()
    : localSmtpMailer({ host: config.SMTP_HOST, port: config.SMTP_PORT, from: config.MAIL_FROM });

const app = createApp({
  logger,
  checkReadiness: async () => {
    await checkDatabaseReadiness(pool, expectations, expectedMigrations);
    await checkAccessCatalogue(pool);
  },
  rateLimit: { windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX },
  trustProxy: config.TRUST_PROXY === 'loopback' ? 'loopback' : false,
  corsOrigins: config.CORS_ORIGINS,
  api: {
    modules: buildApi({ db, settings, mailer, resetCodePepper: config.RESET_CODE_PEPPER, logger }),
    authenticate: authenticate(db, settings),
  },
});

const server = app.listen(config.PORT, config.HOST, () => {
  logger.info({ host: config.HOST, port: config.PORT }, 'HospitalOS API listening');
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    void pool
      .end()
      .then(() => {
        logger.info('shutdown complete');
        process.exit(0);
      })
      .catch(() => process.exit(1));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
