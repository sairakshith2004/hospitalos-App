import {
  cancelPrescriptionRequestSchema,
  createPrescriptionRequestSchema,
  dispenseRequestSchema,
  dispensingSchema,
  prescriptionListSchema,
  prescriptionSchema,
  reasonSchema,
  z,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { idParam } from '../../http/params';
import { requireAnyPermission, requirePermission } from '../../middleware/authenticate';
import { idempotencyKeyOf } from '../shared/idempotency';

import type { PharmacyService } from './pharmacy.service';

/** Prescriptions and dispensing (phase 1.7). */
export function pharmacyRouter(pharmacy: PharmacyService): Router {
  const router = Router();

  router.post(
    '/encounters/:id/prescriptions',
    requirePermission('prescription:create'),
    async (req, res) => {
      const body = createPrescriptionRequestSchema.parse(req.body);
      res
        .status(201)
        .json(
          prescriptionSchema.parse(
            await pharmacy.create(authOf(req), idParam(req.params.id), body, metaOf(req)),
          ),
        );
    },
  );

  router.get('/prescriptions', requirePermission('prescription:dispense'), async (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(prescriptionListSchema.parse({ items: await pharmacy.queue() }));
  });

  router.get(
    '/prescriptions/:id',
    requireAnyPermission(['prescription:dispense', 'prescription:create']),
    async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(prescriptionSchema.parse(await pharmacy.get(authOf(req), idParam(req.params.id))));
    },
  );

  router.post(
    '/prescriptions/:id/cancel',
    requirePermission('prescription:cancel'),
    async (req, res) => {
      const body = cancelPrescriptionRequestSchema.parse(req.body);
      res.json(
        prescriptionSchema.parse(
          await pharmacy.cancel(authOf(req), idParam(req.params.id), body.reason, metaOf(req)),
        ),
      );
    },
  );

  router.post(
    '/prescriptions/:id/close',
    requirePermission('prescription:close'),
    async (req, res) => {
      const body = z.strictObject({ reason: reasonSchema }).parse(req.body);
      res.json(
        prescriptionSchema.parse(
          await pharmacy.close(authOf(req), idParam(req.params.id), body.reason, metaOf(req)),
        ),
      );
    },
  );

  router.post(
    '/prescriptions/:id/dispense',
    requirePermission('prescription:dispense'),
    async (req, res) => {
      const body = dispenseRequestSchema.parse(req.body);
      const result = await pharmacy.dispense(
        authOf(req),
        idParam(req.params.id),
        body.lines,
        idempotencyKeyOf(req.get('idempotency-key')),
        metaOf(req),
      );
      res.status(result.status).json(dispensingSchema.parse(result.body));
    },
  );

  return router;
}
