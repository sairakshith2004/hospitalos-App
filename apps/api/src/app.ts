import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import type { Logger } from './lib/logger';
import { errorHandler, notFound } from './middleware/error-handler';
import { apiRateLimit, type RateLimitOptions } from './middleware/rate-limit';
import { resolveRequestId } from './middleware/request-id';
import { healthRouter, type ReadinessCheck } from './modules/health/health.routes';

export type AppDependencies = Readonly<{
  logger: Logger;
  checkReadiness: ReadinessCheck;
  rateLimit?: RateLimitOptions;
}>;

/** JSON bodies above this size are refused with 413. */
export const JSON_BODY_LIMIT = '100kb';

/** Routes live under /api. Probes: /api/health, /api/ready. Business routes: /api/v1/… (1.2+). */
export const API_PREFIX = '/api';

const DEFAULT_RATE_LIMIT: RateLimitOptions = { windowMs: 60_000, max: 300 };

/**
 * Builds the Express app. Order matters: security headers → request ID and logging → rate limit
 * → body parsing → routes → 404 → error envelope.
 */
export function createApp({
  logger,
  checkReadiness,
  rateLimit = DEFAULT_RATE_LIMIT,
}: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  // No proxy is trusted until a deployment needs it (R9).
  app.set('trust proxy', false);

  app.use(helmet());
  app.use(pinoHttp({ logger, genReqId: resolveRequestId }));
  app.use(apiRateLimit(rateLimit));
  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));

  app.use(API_PREFIX, healthRouter(checkReadiness));

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
