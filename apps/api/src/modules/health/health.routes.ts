import {
  healthResponseSchema,
  readyResponseSchema,
  type HealthResponse,
  type ReadyResponse,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { AppError } from '../../lib/errors';

export type ReadinessCheck = () => Promise<void>;

/**
 * GET /api/health — public: the process is up (never touches the database).
 * GET /api/ready  — public: the database answers as hos_app on an allowed database and has
 *                   exactly the expected migrations; 503 NOT_READY otherwise.
 * Neither returns anything about the environment, versions or configuration.
 */
export function healthRouter(checkReadiness: ReadinessCheck): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const body: HealthResponse = healthResponseSchema.parse({ status: 'ok' });
    res.set('Cache-Control', 'no-store').json(body);
  });

  router.get('/ready', async (req, res) => {
    try {
      await checkReadiness();
    } catch (error) {
      req.log.warn({ reason: error instanceof Error ? error.name : 'unknown' }, 'not ready');
      throw new AppError(503, 'NOT_READY', 'The service is not ready.');
    }
    const body: ReadyResponse = readyResponseSchema.parse({
      status: 'ready',
      checks: { database: 'ok' },
    });
    res.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}
