import {
  cancelLabOrderRequestSchema,
  collectSampleRequestSchema,
  createLabOrderRequestSchema,
  enterResultsRequestSchema,
  labOrderListSchema,
  labOrderSchema,
  LAB_STATUSES,
  rejectSampleRequestSchema,
  z,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { idParam } from '../../http/params';
import { requireAnyPermission, requirePermission } from '../../middleware/authenticate';

import type { LabService } from './lab.service';

/** Laboratory (phase 1.8). Results are viewed in the app only; no export or sharing in R1. */
export function labRouter(lab: LabService): Router {
  const router = Router();
  const LAB_STAFF = ['lab:process', 'lab_result:enter', 'lab_result:verify'] as const;

  router.post(
    '/encounters/:id/lab-orders',
    requirePermission('lab_order:create'),
    async (req, res) => {
      const body = createLabOrderRequestSchema.parse(req.body);
      res
        .status(201)
        .json(
          labOrderSchema.parse(
            await lab.order(authOf(req), idParam(req.params.id), body, metaOf(req)),
          ),
        );
    },
  );

  router.post('/lab-orders/:id/cancel', requirePermission('lab_order:cancel'), async (req, res) => {
    const body = cancelLabOrderRequestSchema.parse(req.body);
    res.json(
      labOrderSchema.parse(
        await lab.cancel(authOf(req), idParam(req.params.id), body.reason, metaOf(req)),
      ),
    );
  });

  router.get('/lab-orders', requireAnyPermission(LAB_STAFF), async (req, res) => {
    const status = z.enum(LAB_STATUSES).optional().parse(req.query.status);
    res
      .set('Cache-Control', 'no-store')
      .json(labOrderListSchema.parse({ items: await lab.worklist(status) }));
  });

  router.get('/lab-orders/:id', requireAnyPermission(LAB_STAFF), async (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(labOrderSchema.parse(await lab.get(idParam(req.params.id))));
  });

  router.post('/lab-orders/:id/collect', requirePermission('lab:process'), async (req, res) => {
    const body = collectSampleRequestSchema.parse(req.body);
    res.json(
      labOrderSchema.parse(
        await lab.collect(authOf(req), idParam(req.params.id), body.barcode, metaOf(req)),
      ),
    );
  });

  router.post(
    '/lab-orders/:id/reject-sample',
    requirePermission('lab:process'),
    async (req, res) => {
      const body = rejectSampleRequestSchema.parse(req.body);
      res.json(
        labOrderSchema.parse(
          await lab.rejectSample(authOf(req), idParam(req.params.id), body.reason, metaOf(req)),
        ),
      );
    },
  );

  router.post('/lab-orders/:id/process', requirePermission('lab:process'), async (req, res) => {
    res.json(
      labOrderSchema.parse(
        await lab.startProcessing(authOf(req), idParam(req.params.id), metaOf(req)),
      ),
    );
  });

  router.post(
    '/lab-orders/:id/results',
    requirePermission('lab_result:enter'),
    async (req, res) => {
      const body = enterResultsRequestSchema.parse(req.body);
      res.json(
        labOrderSchema.parse(
          await lab.enterResults(authOf(req), idParam(req.params.id), body.results, metaOf(req)),
        ),
      );
    },
  );

  router.post(
    '/lab-orders/:id/verify',
    requirePermission('lab_result:verify'),
    async (req, res) => {
      res.json(
        labOrderSchema.parse(await lab.verify(authOf(req), idParam(req.params.id), metaOf(req))),
      );
    },
  );

  router.post(
    '/lab-orders/:id/reject-results',
    requirePermission('lab_result:verify'),
    async (req, res) => {
      const body = rejectSampleRequestSchema.parse(req.body);
      res.json(
        labOrderSchema.parse(
          await lab.rejectResults(authOf(req), idParam(req.params.id), body.reason, metaOf(req)),
        ),
      );
    },
  );

  return router;
}
