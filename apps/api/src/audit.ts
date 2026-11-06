import { sql } from 'drizzle-orm';

import { run, type Executor } from './db/sql';
import type { RequestMeta } from './http/context';

/**
 * Audit rows are written in the same transaction as the change they describe (architecture §3
 * rule 7). They never contain passwords, tokens, reset codes or other secrets.
 */
export type Actor =
  Readonly<{ type: 'user'; userId: string }> | Readonly<{ type: 'system'; label: string }>;

export type AuditEntry = Readonly<{
  action: string;
  entityType: string;
  entityId?: string | null;
  patientId?: string | null;
  changes?: Record<string, unknown> | null;
  reason?: string | null;
}>;

export async function writeAudit(
  db: Executor,
  actor: Actor,
  meta: Partial<RequestMeta>,
  entry: AuditEntry,
): Promise<void> {
  await run(
    db,
    sql`insert into audit_logs
          (actor_type, actor_user_id, actor_label, action, entity_type, entity_id, patient_id,
           request_id, ip, changes, reason)
        values (${actor.type}, ${actor.type === 'user' ? actor.userId : null},
                ${actor.type === 'system' ? actor.label.slice(0, 120) : null},
                ${entry.action}, ${entry.entityType}, ${entry.entityId ?? null},
                ${entry.patientId ?? null}, ${meta.requestId ?? null}, ${meta.ip ?? null},
                ${entry.changes ? JSON.stringify(entry.changes) : null}::jsonb,
                ${entry.reason ?? null})`,
  );
}

export const userActor = (userId: string): Actor => ({ type: 'user', userId });
export const systemActor = (label: string): Actor => ({ type: 'system', label });
