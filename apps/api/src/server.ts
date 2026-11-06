import { fileURLToPath } from 'node:url';

import { createApp } from './app';
import { ConfigError, loadConfig, type ApiConfig } from './config/env';
import { createPool } from './db/client';
import { verifyDatabaseIdentity } from './db/guards';
import { loadMigrations } from './db/migrate';
import { checkDatabaseReadiness } from './db/readiness';
import { createLogger } from './lib/logger';

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

const app = createApp({
  logger,
  checkReadiness: () => checkDatabaseReadiness(pool, expectations, expectedMigrations),
  rateLimit: { windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX },
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
