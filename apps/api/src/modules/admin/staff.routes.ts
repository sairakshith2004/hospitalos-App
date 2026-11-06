import {
  authAuditListSchema,
  createStaffRequestSchema,
  permissionListSchema,
  roleChangeRequestSchema,
  roleListSchema,
  staffListSchema,
  staffSummarySchema,
  statusChangeRequestSchema,
  uuidSchema,
} from '@hospitalos/contracts';
import { Router } from 'express';

import { authOf, metaOf } from '../../http/context';
import { AppError } from '../../lib/errors';
import { requireAnyPermission, requirePermission } from '../../middleware/authenticate';

import type { StaffService } from './staff.service';

function idParam(value: unknown): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return parsed.data;
}

const STAFF_READERS = ['user:create', 'user:manage', 'user_role:assign'] as const;

/** Minimal staff-account administration (phase 1.2b, architecture §6.3). */
export function staffRouter(staff: StaffService): Router {
  const router = Router();

  router.get('/admin/staff', requireAnyPermission(STAFF_READERS), async (_req, res) => {
    res.json(staffListSchema.parse({ items: await staff.list() }));
  });

  router.get('/admin/staff/:id', requireAnyPermission(STAFF_READERS), async (req, res) => {
    res.json(staffSummarySchema.parse(await staff.get(idParam(req.params.id))));
  });

  router.post('/admin/staff', requirePermission('user:create'), async (req, res) => {
    const body = createStaffRequestSchema.parse(req.body);
    const created = await staff.create(authOf(req), body, metaOf(req));
    res.status(201).json(staffSummarySchema.parse(created));
  });

  router.post(
    '/admin/users/:id/roles/grant',
    requirePermission('user_role:assign'),
    async (req, res) => {
      const body = roleChangeRequestSchema.parse(req.body);
      const updated = await staff.changeRole(
        authOf(req),
        idParam(req.params.id),
        body.role,
        'grant',
        body.reason,
        metaOf(req),
      );
      res.json(staffSummarySchema.parse(updated));
    },
  );

  router.post(
    '/admin/users/:id/roles/revoke',
    requirePermission('user_role:assign'),
    async (req, res) => {
      const body = roleChangeRequestSchema.parse(req.body);
      const updated = await staff.changeRole(
        authOf(req),
        idParam(req.params.id),
        body.role,
        'revoke',
        body.reason,
        metaOf(req),
      );
      res.json(staffSummarySchema.parse(updated));
    },
  );

  router.post('/admin/users/:id/status', requirePermission('user:manage'), async (req, res) => {
    const body = statusChangeRequestSchema.parse(req.body);
    const updated = await staff.setStatus(
      authOf(req),
      idParam(req.params.id),
      body.status,
      body.reason,
      metaOf(req),
    );
    res.json(staffSummarySchema.parse(updated));
  });

  router.get('/admin/roles', requireAnyPermission(STAFF_READERS), (_req, res) => {
    res.json(roleListSchema.parse(staff.roles()));
  });

  router.get('/admin/permissions', requireAnyPermission(STAFF_READERS), (_req, res) => {
    res.json(permissionListSchema.parse(staff.permissions()));
  });

  router.get('/admin/audit/auth', requirePermission('audit:read'), async (_req, res) => {
    const rows = await staff.authAudit();
    res.json(
      authAuditListSchema.parse({
        items: rows.map((row) => ({
          id: row.id,
          occurredAt: row.occurred_at,
          action: row.action,
          actorUserId: row.actor_user_id,
          actorLabel: row.actor_label,
          entityType: row.entity_type,
          entityId: row.entity_id,
          reason: row.reason,
        })),
      }),
    );
  });

  return router;
}
