import {
  appointmentListQuerySchema,
  appointmentListSchema,
  appointmentSchema,
  availabilityQuerySchema,
  availabilitySchema,
  bookAppointmentRequestSchema,
  cancelRequestSchema,
  rescheduleRequestSchema,
  walkInRequestSchema,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { idParam } from '../../http/params';
import { AppError } from '../../lib/errors';
import { requireAnyPermission, requirePermission } from '../../middleware/authenticate';
import { idempotencyKeyOf } from '../shared/idempotency';

import type { SchedulingService } from './scheduling.service';

/** Appointments, reception and the queue (phase 1.5). */
export function schedulingRouter(scheduling: SchedulingService): Router {
  const router = Router();

  router.get('/doctors/:id/availability', requirePermission('schedule:read'), async (req, res) => {
    const { date } = availabilityQuerySchema.parse(req.query);
    res
      .set('Cache-Control', 'no-store')
      .json(availabilitySchema.parse(await scheduling.availability(idParam(req.params.id), date)));
  });

  router.get(
    '/appointments',
    requireAnyPermission(['appointment:read_all', 'encounter:write']),
    async (req, res) => {
      const query = appointmentListQuerySchema.parse(req.query);
      res
        .set('Cache-Control', 'no-store')
        .json(appointmentListSchema.parse({ items: await scheduling.list(authOf(req), query) }));
    },
  );

  router.get(
    '/appointments/:id',
    requireAnyPermission(['appointment:read_all', 'encounter:write']),
    async (req, res) => {
      res
        .set('Cache-Control', 'no-store')
        .json(appointmentSchema.parse(await scheduling.get(idParam(req.params.id))));
    },
  );

  router.post('/appointments', requirePermission('appointment:book'), async (req, res) => {
    const body = bookAppointmentRequestSchema.parse(req.body);
    if (body.followUpId !== undefined && !authOf(req).permissions.has('followup:schedule')) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this.');
    }
    const result = await scheduling.book(
      authOf(req),
      body,
      idempotencyKeyOf(req.get('idempotency-key')),
      metaOf(req),
    );
    res.status(result.status).json(result.body);
  });

  router.post(
    '/appointments/walk-in',
    requirePermission('appointment:check_in'),
    async (req, res) => {
      const body = walkInRequestSchema.parse(req.body);
      const result = await scheduling.walkIn(
        authOf(req),
        body,
        idempotencyKeyOf(req.get('idempotency-key')),
        metaOf(req),
      );
      res.status(result.status).json(result.body);
    },
  );

  router.post(
    '/appointments/:id/check-in',
    requirePermission('appointment:check_in'),
    async (req, res) => {
      const result = await scheduling.checkIn(
        authOf(req),
        idParam(req.params.id),
        idempotencyKeyOf(req.get('idempotency-key')),
        metaOf(req),
      );
      res.status(result.status).json(result.body);
    },
  );

  router.post(
    '/appointments/:id/cancel',
    requirePermission('appointment:cancel'),
    async (req, res) => {
      const body = cancelRequestSchema.parse(req.body);
      res.json(
        appointmentSchema.parse(
          await scheduling.cancel(authOf(req), idParam(req.params.id), body.reason, metaOf(req)),
        ),
      );
    },
  );

  router.post(
    '/appointments/:id/reschedule',
    requirePermission('appointment:reschedule'),
    async (req, res) => {
      const body = rescheduleRequestSchema.parse(req.body);
      res.json(
        appointmentSchema.parse(
          await scheduling.reschedule(
            authOf(req),
            idParam(req.params.id),
            body.slotStart,
            body.reason,
            metaOf(req),
          ),
        ),
      );
    },
  );

  router.post(
    '/appointments/:id/no-show',
    requirePermission('appointment:mark_no_show'),
    async (req, res) => {
      res.json(
        appointmentSchema.parse(
          await scheduling.markNoShow(authOf(req), idParam(req.params.id), metaOf(req)),
        ),
      );
    },
  );

  router.get('/queue', requirePermission('queue:read'), async (req, res) => {
    const doctorId =
      typeof req.query.doctorId === 'string' ? idParam(req.query.doctorId) : undefined;
    res
      .set('Cache-Control', 'no-store')
      .json(appointmentListSchema.parse({ items: await scheduling.queue(authOf(req), doctorId) }));
  });

  return router;
}
