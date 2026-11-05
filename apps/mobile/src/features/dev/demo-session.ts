import type { Permission } from '@/features/access/permissions';
import { ROLES, type RoleId } from '@/features/access/roles';
import type { Session } from '@/features/session/types';

import { devToolsEnabled } from './flags';

/**
 * DEVELOPMENT ONLY. Approximate permission sets so each role's navigation can be inspected
 * before the API exists. This is NOT authorization: production sessions get permissions
 * from the API, and this module refuses to create a session in production builds.
 */
const DEMO_ROLE_PERMISSIONS: Record<RoleId, readonly Permission[]> = {
  'super-admin': ['admin.users.read', 'audit.read', 'system.read'],
  'hospital-admin': [
    'admin.users.read',
    'audit.read',
    'system.read',
    'appointments.read',
    'finance.read',
    'hr.read',
    'inventory.read',
  ],
  receptionist: ['patients.read', 'appointments.read'],
  doctor: ['patients.read', 'appointments.read', 'clinical.read', 'lab.read'],
  nurse: ['patients.read', 'nursing.read'],
  pharmacist: ['pharmacy.read', 'inventory.read'],
  'lab-technician': ['lab.read'],
  'finance-manager': ['finance.read'],
  'hr-manager': ['hr.read', 'payroll.read'],
  'inventory-manager': ['inventory.read'],
  'marketing-manager': ['marketing.read'],
};

export class DemoModeUnavailableError extends Error {
  override name = 'DemoModeUnavailableError';
}

export function createDemoSession(roleId: RoleId): Session {
  if (!devToolsEnabled) {
    throw new DemoModeUnavailableError('Demo sessions are disabled in production builds.');
  }
  return {
    kind: 'demo',
    displayName: `Demo ${ROLES[roleId].title}`,
    demoRoleId: roleId,
    permissions: DEMO_ROLE_PERMISSIONS[roleId],
  };
}
