import {
  patientSearchQuerySchema,
  patientSearchResultSchema,
  patientSummarySchema,
  recordAllergyRequestSchema,
  registerPatientRequestSchema,
  updateDemographicsRequestSchema,
  visitHistorySchema,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { idParam } from '../../http/params';
import { requestIdOf } from '../../middleware/request-id';
import { requirePermission } from '../../middleware/authenticate';

import type { PatientsService } from './patients.service';

/** Patients (phase 1.4). HR, inventory and marketing have no patient permission: 403. */
export function patientsRouter(patients: PatientsService): Router {
  const router = Router();

  router.post('/patients', requirePermission('patient:create'), async (req, res) => {
    const body = registerPatientRequestSchema.parse(req.body);
    const result = await patients.register(authOf(req), body, metaOf(req));
    if (result.kind === 'duplicates') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message:
            'This may be a patient who is already registered. Check the matches before continuing.',
          requestId: requestIdOf(req),
        },
        candidates: result.candidates,
      });
      return;
    }
    res.status(201).json(patientSummarySchema.parse(result.patient));
  });

  router.get('/patients', requirePermission('patient:read_demographics'), async (req, res) => {
    const { q } = patientSearchQuerySchema.parse(req.query);
    const items = await patients.search(authOf(req), q, metaOf(req));
    res.set('Cache-Control', 'no-store').json(patientSearchResultSchema.parse({ items }));
  });

  router.get('/patients/:id', requirePermission('patient:read_demographics'), async (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(patientSummarySchema.parse(await patients.get(idParam(req.params.id))));
  });

  router.patch(
    '/patients/:id',
    requirePermission('patient:update_demographics'),
    async (req, res) => {
      const body = updateDemographicsRequestSchema.parse(req.body);
      const updated = await patients.updateDemographics(
        authOf(req),
        idParam(req.params.id),
        body,
        metaOf(req),
      );
      res.json(patientSummarySchema.parse(updated));
    },
  );

  router.get(
    '/patients/:id/visits',
    requirePermission('patient:read_demographics'),
    async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(visitHistorySchema.parse({ items: await patients.visits(idParam(req.params.id)) }));
    },
  );

  router.post('/patients/:id/allergies', requirePermission('allergy:record'), async (req, res) => {
    const body = recordAllergyRequestSchema.parse(req.body);
    const id = await patients.recordAllergy(authOf(req), idParam(req.params.id), body, metaOf(req));
    res.status(201).json({ id });
  });

  return router;
}
