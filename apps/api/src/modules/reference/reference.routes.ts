import {
  createScheduleRequestSchema,
  departmentListSchema,
  doctorListSchema,
  doctorSchema,
  feeUpdateRequestSchema,
  hospitalInfoSchema,
  labTestListSchema,
  medicineListSchema,
  medicineSearchQuerySchema,
  priceUpdateRequestSchema,
  reasonSchema,
  scheduleListSchema,
  serviceListSchema,
  z,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { idParam } from '../../http/params';
import { requireAnyPermission, requirePermission } from '../../middleware/authenticate';

import type { ReferenceService } from './reference.service';

/** Hospital reference data (phase 1.3). Reads for the roles whose work needs them; changes audited. */
export function referenceRouter(reference: ReferenceService): Router {
  const router = Router();

  router.get('/hospital', async (_req, res) => {
    res.json(hospitalInfoSchema.parse(await reference.hospital()));
  });

  router.get('/departments', async (_req, res) => {
    res.json(departmentListSchema.parse({ items: await reference.departments() }));
  });

  router.get('/doctors', requirePermission('schedule:read'), async (req, res) => {
    const department = z
      .string()
      .trim()
      .toUpperCase()
      .max(20)
      .optional()
      .parse(req.query.department);
    res.json(doctorListSchema.parse({ items: await reference.doctors(department) }));
  });

  router.get('/doctors/:id', requirePermission('schedule:read'), async (req, res) => {
    res.json(doctorSchema.parse(await reference.doctor(idParam(req.params.id))));
  });

  router.get('/doctors/:id/schedules', requirePermission('schedule:read'), async (req, res) => {
    res.json(
      scheduleListSchema.parse({ items: await reference.schedules(idParam(req.params.id)) }),
    );
  });

  router.post('/doctors/:id/schedules', requirePermission('schedule:manage'), async (req, res) => {
    const body = createScheduleRequestSchema.parse(req.body);
    const id = await reference.addSchedule(authOf(req), idParam(req.params.id), body, metaOf(req));
    res.status(201).json({ id });
  });

  router.post(
    '/schedules/:id/deactivate',
    requirePermission('schedule:manage'),
    async (req, res) => {
      const body = z.strictObject({ reason: reasonSchema }).parse(req.body);
      await reference.deactivateSchedule(
        authOf(req),
        idParam(req.params.id),
        body.reason,
        metaOf(req),
      );
      res.status(204).end();
    },
  );

  router.put('/doctors/:id/fee', requirePermission('fee:manage'), async (req, res) => {
    const body = feeUpdateRequestSchema.parse(req.body);
    const doctor = await reference.updateFee(
      authOf(req),
      idParam(req.params.id),
      body.consultationFeePaise,
      body.reason,
      metaOf(req),
    );
    res.json(doctorSchema.parse(doctor));
  });

  router.get(
    '/services',
    requireAnyPermission([
      'invoice:read',
      'price:manage',
      'lab_order:create',
      'schedule:read',
      'lab:process',
    ]),
    async (_req, res) => {
      res.json(serviceListSchema.parse({ items: await reference.services() }));
    },
  );

  router.put('/services/:id/price', requirePermission('price:manage'), async (req, res) => {
    const body = priceUpdateRequestSchema.parse(req.body);
    await reference.updatePrice(
      authOf(req),
      idParam(req.params.id),
      body.pricePaise,
      body.reason,
      metaOf(req),
    );
    res.status(204).end();
  });

  router.get('/medicines', requirePermission('medicine:search'), async (req, res) => {
    const { q } = medicineSearchQuerySchema.parse(req.query);
    res.json(medicineListSchema.parse({ items: await reference.searchMedicines(q) }));
  });

  router.get(
    '/lab-tests',
    requireAnyPermission([
      'lab_order:create',
      'lab:process',
      'lab_result:enter',
      'lab_result:verify',
    ]),
    async (_req, res) => {
      res.json(labTestListSchema.parse({ items: await reference.labTests() }));
    },
  );

  return router;
}
