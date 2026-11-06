import express, { type Express, type RequestHandler } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import type { Logger } from './lib/logger';
import { withoutQuery } from './security/log-request';
import { cors } from './middleware/cors';
import { errorHandler, notFound } from './middleware/error-handler';
import { apiRateLimit, type RateLimitOptions } from './middleware/rate-limit';
import { resolveRequestId } from './middleware/request-id';
import type { ApiModules } from './modules/api';
import { healthRouter, type ReadinessCheck } from './modules/health/health.routes';

export type AppDependencies = Readonly<{
  logger: Logger;
  checkReadiness: ReadinessCheck;
  rateLimit?: RateLimitOptions;
  /** Business API under /api/v1. Omitted in probe-only tests. */
  api?: Readonly<{ modules: ApiModules; authenticate: RequestHandler }>;
  /** Express `trust proxy`. Off unless a deployment puts the API behind a known proxy. */
  trustProxy?: boolean | string;
  /** Browser origins allowed by CORS; empty means none. */
  corsOrigins?: readonly string[];
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
  api,
  trustProxy = false,
  corsOrigins = [],
}: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  // No proxy is trusted until a deployment needs it (R9).
  app.set('trust proxy', trustProxy);

  app.use(helmet());
  app.use(cors(corsOrigins));
  app.use(pinoHttp({ logger, genReqId: resolveRequestId, serializers: { req: withoutQuery } }));
  app.use(apiRateLimit(rateLimit));
  app.use(express.json({ limit: JSON_BODY_LIMIT, strict: true }));

  app.use(API_PREFIX, healthRouter(checkReadiness));

  if (api) {
    const v1 = `${API_PREFIX}/v1`;
    app.use(v1, ...api.modules.gate);
    for (const router of api.modules.publicRouters) app.use(v1, router);
    app.use(v1, api.authenticate);
    for (const router of api.modules.protectedRouters) app.use(v1, router);
  }

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
