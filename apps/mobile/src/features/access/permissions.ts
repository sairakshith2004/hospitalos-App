/**
 * The HospitalOS permission catalogue: the 88 codes of the reference permission model, from the
 * single canonical copy in `@hospitalos/contracts` (shared with the API; KI-6 resolved in phase 1.2).
 *
 * A signed-in user's permissions come from the API (`GET /api/v1/auth/me`). The app uses them only
 * to decide what to SHOW; the API checks every permission again on each request.
 */
import { PERMISSIONS, isPermission, type Permission } from '@hospitalos/contracts';

export { PERMISSIONS, isPermission, type Permission };

/** Deny by default: an unknown or missing permission is never granted. */
export function hasPermission(granted: readonly Permission[], required: Permission): boolean {
  return granted.includes(required);
}

/** True when at least one of `required` is granted. An empty `required` list grants nothing. */
export function hasAnyPermission(
  granted: readonly Permission[],
  required: readonly Permission[],
): boolean {
  return required.some((code) => granted.includes(code));
}
