/**
 * Permission catalogue as the client understands it. In production these strings come
 * from the API after sign-in; the client only uses them to decide what to SHOW. The API
 * enforces every permission again on each request.
 */
export const PERMISSIONS = [
  'patients.read',
  'appointments.read',
  'clinical.read',
  'nursing.read',
  'pharmacy.read',
  'lab.read',
  'finance.read',
  'hr.read',
  'payroll.read',
  'inventory.read',
  'admin.users.read',
  'audit.read',
  'marketing.read',
  'system.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Deny by default: an unknown or missing permission is never granted. */
export function hasPermission(granted: readonly Permission[], required: Permission): boolean {
  return granted.includes(required);
}
