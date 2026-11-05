import type { Permission } from '@/features/access/permissions';
import type { RoleCode, RoleId } from '@/features/access/roles';

/**
 * A DEVELOPMENT-ONLY preview session, created by the role preview in development builds.
 *
 * It deliberately has no access token, refresh token or any other credential, so it can never be
 * used to call the API. Its permissions only decide what the app shows.
 */
export type DemoSession = Readonly<{
  kind: 'demo';
  displayName: string;
  demoRoleId: RoleId;
  roles: readonly RoleCode[];
  permissions: readonly Permission[];
}>;

/**
 * A server-issued session (phase 1.2): identity, roles and permissions exactly as returned by
 * `GET /v1/auth/me`. Credentials are never stored on this object; the session manager keeps the
 * access token in memory and the refresh token in SecureStore. Nothing creates one in Phase 1.0.
 */
export type AuthenticatedSession = Readonly<{
  kind: 'authenticated';
  userId: string;
  displayName: string;
  roles: readonly RoleCode[];
  permissions: readonly Permission[];
}>;

export type Session = DemoSession | AuthenticatedSession;

export type SessionState = { status: 'signed-out' } | { status: 'signed-in'; session: Session };
