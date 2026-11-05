import type { Permission } from '@/features/access/permissions';
import type { RoleId } from '@/features/access/roles';

/**
 * A signed-in session. Navigation reads `permissions` only. `demoRoleId` exists solely
 * for the development role preview and is never sent to, or trusted by, the API.
 * An `authenticated` variant (server-issued permissions) is added in Step 17.
 */
export type Session = {
  kind: 'demo';
  displayName: string;
  demoRoleId: RoleId;
  permissions: readonly Permission[];
};

export type SessionState = { status: 'signed-out' } | { status: 'signed-in'; session: Session };
