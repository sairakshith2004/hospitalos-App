import { dashboardSchema } from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf } from '../../http/context';

import type { DashboardService } from './dashboard.service';

/** GET /dashboard: the signed-in user's Home figures, from live queries (DB-1). */
export function dashboardRouter(dashboard: DashboardService): Router {
  const router = Router();
  router.get('/dashboard', async (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(dashboardSchema.parse(await dashboard.forUser(authOf(req))));
  });
  return router;
}
