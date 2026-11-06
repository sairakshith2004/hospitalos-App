import {
  chartSchema,
  dateSchema,
  diagnosisRequestSchema,
  encounterSchema,
  errorEncounterRequestSchema,
  followUpListSchema,
  followUpRequestSchema,
  noteRequestSchema,
  nurseAssignmentListSchema,
  nurseAssignmentRequestSchema,
  reasonSchema,
  startEncounterRequestSchema,
  vitalsRequestSchema,
  z,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { idParam } from '../../http/params';
import { requireAnyPermission, requirePermission } from '../../middleware/authenticate';

import type { ClinicalService } from './clinical.service';

/** Consultations, nursing and follow-ups (phases 1.6 and 1.10). */
export function clinicalRouter(clinical: ClinicalService): Router {
  const router = Router();

  router.get(
    '/patients/:id/chart',
    requirePermission('patient:read_clinical'),
    async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(
          chartSchema.parse(await clinical.chart(authOf(req), idParam(req.params.id), metaOf(req))),
        );
    },
  );

  router.post('/encounters', requirePermission('encounter:write'), async (req, res) => {
    const body = startEncounterRequestSchema.parse(req.body);
    res
      .status(201)
      .json(
        encounterSchema.parse(
          await clinical.start(authOf(req), body.appointmentId, body.chiefComplaint, metaOf(req)),
        ),
      );
  });

  router.get('/encounters/:id', requirePermission('patient:read_clinical'), async (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(
        encounterSchema.parse(await clinical.get(authOf(req), idParam(req.params.id), metaOf(req))),
      );
  });

  router.post('/encounters/:id/notes', requirePermission('encounter:write'), async (req, res) => {
    const body = noteRequestSchema.parse(req.body);
    res
      .status(201)
      .json(
        encounterSchema.parse(
          await clinical.addNote(
            authOf(req),
            idParam(req.params.id),
            body.kind,
            body.body,
            metaOf(req),
          ),
        ),
      );
  });

  router.post(
    '/encounters/:id/diagnoses',
    requirePermission('encounter:write'),
    async (req, res) => {
      const body = diagnosisRequestSchema.parse(req.body);
      res
        .status(201)
        .json(
          encounterSchema.parse(
            await clinical.addDiagnosis(authOf(req), idParam(req.params.id), body, metaOf(req)),
          ),
        );
    },
  );

  router.post(
    '/encounters/:id/complete',
    requirePermission('encounter:write'),
    async (req, res) => {
      res.json(
        encounterSchema.parse(
          await clinical.complete(authOf(req), idParam(req.params.id), metaOf(req)),
        ),
      );
    },
  );

  router.post(
    '/encounters/:id/entered-in-error',
    requirePermission('encounter:write'),
    async (req, res) => {
      const body = errorEncounterRequestSchema.parse(req.body);
      await clinical.enteredInError(authOf(req), idParam(req.params.id), body.reason, metaOf(req));
      res.status(204).end();
    },
  );

  router.post('/vitals', requirePermission('vitals:record'), async (req, res) => {
    const body = vitalsRequestSchema.parse(req.body);
    res.status(201).json({ id: await clinical.recordVitals(authOf(req), body, metaOf(req)) });
  });

  router.post(
    '/encounters/:id/follow-ups',
    requirePermission('followup:recommend'),
    async (req, res) => {
      const body = followUpRequestSchema.parse(req.body);
      res.status(201).json({
        id: await clinical.recommendFollowUp(
          authOf(req),
          idParam(req.params.id),
          body,
          metaOf(req),
        ),
      });
    },
  );

  router.get(
    '/follow-ups',
    requireAnyPermission(['followup:schedule', 'followup:recommend']),
    async (req, res) => {
      const status = z
        .enum(['pending', 'booked', 'completed', 'missed', 'cancelled'])
        .optional()
        .parse(req.query.status);
      res
        .set('Cache-Control', 'no-store')
        .json(followUpListSchema.parse({ items: await clinical.followUps(authOf(req), status) }));
    },
  );

  router.post(
    '/follow-ups/:id/cancel',
    requireAnyPermission(['followup:schedule', 'followup:recommend']),
    async (req, res) => {
      const body = z.strictObject({ reason: reasonSchema }).parse(req.body);
      await clinical.cancelFollowUp(authOf(req), idParam(req.params.id), body.reason, metaOf(req));
      res.status(204).end();
    },
  );

  router.get(
    '/nurse-assignments',
    requireAnyPermission(['nurse_assignment:manage', 'vitals:record']),
    async (req, res) => {
      const auth = authOf(req);
      const date = dateSchema.optional().parse(req.query.date);
      const mineOnly = !auth.permissions.has('nurse_assignment:manage');
      res.set('Cache-Control', 'no-store').json(
        nurseAssignmentListSchema.parse({
          items: await clinical.nurseAssignments(auth, date, mineOnly),
        }),
      );
    },
  );

  router.post(
    '/nurse-assignments',
    requirePermission('nurse_assignment:manage'),
    async (req, res) => {
      const body = nurseAssignmentRequestSchema.parse(req.body);
      res.status(201).json({ id: await clinical.assignNurse(authOf(req), body, metaOf(req)) });
    },
  );

  router.post(
    '/nurse-assignments/:id/revoke',
    requirePermission('nurse_assignment:manage'),
    async (req, res) => {
      const body = z.strictObject({ reason: reasonSchema }).parse(req.body);
      await clinical.revokeNurseAssignment(
        authOf(req),
        idParam(req.params.id),
        body.reason,
        metaOf(req),
      );
      res.status(204).end();
    },
  );

  return router;
}
