import { findRoleByCode, ROLES, type RoleDefinition } from '@/features/access/roles';

import type { Session } from './types';

/** The role to name on screen: the previewed role, or the first role the server returned. */
export function primaryRole(session: Session): RoleDefinition | undefined {
  if (session.kind === 'demo') return ROLES[session.demoRoleId];
  const [first] = session.roles;
  return first ? findRoleByCode(first) : undefined;
}
