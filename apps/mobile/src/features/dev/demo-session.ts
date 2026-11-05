import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { ROLES, type RoleId } from '@/features/access/roles';
import type { DemoSession } from '@/features/session/types';

import { devToolsEnabled } from './flags';

/**
 * DEVELOPMENT ONLY. Builds a local preview session so each role's navigation can be inspected
 * before the API exists. Its grants are the reference role map, but it is NOT authorization:
 * it holds no credential, never reaches the API, and this module refuses to create one in
 * production builds. Real sessions get their permissions from the API.
 */
export class DemoModeUnavailableError extends Error {
  override name = 'DemoModeUnavailableError';
}

export function createDemoSession(roleId: RoleId): DemoSession {
  if (!devToolsEnabled) {
    throw new DemoModeUnavailableError('Demo sessions are disabled in production builds.');
  }
  const role = ROLES[roleId];
  return {
    kind: 'demo',
    displayName: `Demo ${role.title}`,
    demoRoleId: roleId,
    roles: [role.code],
    permissions: ROLE_PERMISSIONS[role.code],
  };
}
