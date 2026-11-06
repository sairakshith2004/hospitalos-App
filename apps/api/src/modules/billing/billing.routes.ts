import {
  correctionListSchema,
  invoiceListSchema,
  invoiceSchema,
  paymentRequestSchema,
  receiptSchema,
  uuidSchema,
  z,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { idParam } from '../../http/params';
import { requirePermission } from '../../middleware/authenticate';
import { idempotencyKeyOf } from '../shared/idempotency';

import type { BillingService } from './billing.service';

/**
 * Basic billing and payments (phase 1.9). Receipts are viewed in the app only. There is no credit
 * note, refund, discount, export or share endpoint in R1 (they arrive in R3).
 */
export function billingRouter(billing: BillingService): Router {
  const router = Router();

  router.get('/invoices', requirePermission('invoice:read'), async (req, res) => {
    const query = z
      .object({
        status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'void']).optional(),
        patientId: uuidSchema.optional(),
        appointmentId: uuidSchema.optional(),
      })
      .parse(req.query);
    res
      .set('Cache-Control', 'no-store')
      .json(invoiceListSchema.parse({ items: await billing.list(query) }));
  });

  router.get('/invoices/:id', requirePermission('invoice:read'), async (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(invoiceSchema.parse(await billing.get(idParam(req.params.id))));
  });

  router.post('/invoices/:id/issue', requirePermission('invoice:issue'), async (req, res) => {
    res.json(
      invoiceSchema.parse(await billing.issue(authOf(req), idParam(req.params.id), metaOf(req))),
    );
  });

  router.post('/invoices/:id/payments', requirePermission('payment:record'), async (req, res) => {
    const body = paymentRequestSchema.parse(req.body);
    const result = await billing.pay(
      authOf(req),
      idParam(req.params.id),
      body,
      idempotencyKeyOf(req.get('idempotency-key')),
      metaOf(req),
    );
    res.status(result.status).json(receiptSchema.parse(result.body));
  });

  router.get('/payments/:id/receipt', requirePermission('invoice:read'), async (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(receiptSchema.parse(await billing.receipt(idParam(req.params.id))));
  });

  router.get('/billing-corrections', requirePermission('invoice:read'), async (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(correctionListSchema.parse({ items: await billing.openCorrections() }));
  });

  return router;
}
