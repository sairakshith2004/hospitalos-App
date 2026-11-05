import { getDemoDashboard, type DemoDashboard } from '@/features/dev/demo-dashboard';
import { devToolsEnabled } from '@/features/dev/flags';
import type { Session } from '@/features/session/types';

/**
 * What the Home dashboard may show. This is the ONLY place the dashboard reaches demo content
 * (enforced by ESLint):
 *
 * - `demo`: synthetic figures, only for a development demo session in a development build, always
 *   rendered under a DEMO DATA label.
 * - `pending-api`: everything else, including every server-issued session. Real figures come from
 *   the API in phase 1.11; until then the dashboard shows an honest empty state.
 */
export type DashboardContent =
  Readonly<{ kind: 'demo'; dashboard: DemoDashboard }> | Readonly<{ kind: 'pending-api' }>;

export function getDashboardContent(session: Session): DashboardContent {
  if (session.kind !== 'demo' || !devToolsEnabled) return { kind: 'pending-api' };
  const [role] = session.roles;
  const dashboard = role ? getDemoDashboard(role) : undefined;
  return dashboard ? { kind: 'demo', dashboard } : { kind: 'pending-api' };
}
