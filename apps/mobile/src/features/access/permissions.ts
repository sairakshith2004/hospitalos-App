/**
 * The HospitalOS permission catalogue: exactly the 88 codes of the reference permission model,
 * in the reference's order (see docs/MOBILE-ROLE-MODULE-MATRIX.md).
 *
 * In production the signed-in user's permissions come from the API (`GET /v1/auth/me`). The app
 * uses them only to decide what to SHOW; the API checks every permission again on each request.
 * This list moves to `packages/shared` in phase 1.1 so the API and the app share one copy.
 */
export const PERMISSIONS = [
  'user:manage',
  'user:create',
  'user_role:assign',
  'role:manage',
  'system_settings:manage',
  'security_settings:manage',
  'operational_settings:manage',
  'department:manage',
  'audit:read',
  'break_glass:review',
  'day_close:run',
  'patient:create',
  'patient:update_demographics',
  'patient:read_demographics',
  'patient:read_clinical',
  'allergy:record',
  'history:write',
  'schedule:read',
  'schedule:manage',
  'fee:manage',
  'nurse_assignment:manage',
  'appointment:book',
  'appointment:cancel',
  'appointment:reschedule',
  'appointment:check_in',
  'appointment:mark_no_show',
  'followup:schedule',
  'appointment:read_all',
  'queue:read',
  'encounter:write',
  'prescription:create',
  'prescription:cancel',
  'lab_order:create',
  'lab_order:cancel',
  'followup:recommend',
  'vitals:record',
  'medicine:search',
  'prescription:dispense',
  'dispense:return',
  'dispense:substitute',
  'prescription:close',
  'medicine:catalog_manage',
  'stock:adjust_pharmacy',
  'stock:adjust_store',
  'goods_receipt:create',
  'stock_transfer:dispatch_pharmacy',
  'stock_transfer:dispatch_store',
  'stock_transfer:receive_pharmacy',
  'stock_transfer:receive_store',
  'supplier:manage',
  'po:create',
  'po:approve',
  'lab:process',
  'lab_result:enter',
  'lab_result:verify',
  'invoice:read',
  'invoice:issue',
  'invoice:discard_draft',
  'payment:record',
  'refund:request',
  'discount:apply',
  'discount:approve',
  'refund:approve',
  'invoice:void',
  'credit_note:create',
  'payment:reverse',
  'price:manage',
  'expense:create',
  'expense:approve',
  'report:finance',
  'report:operational',
  'operations:oversee',
  'employee:read',
  'employee:manage',
  'attendance:manage',
  'leave:approve',
  'payroll:manage',
  'leave:request',
  'equipment:manage',
  'maintenance:log',
  'enquiry:manage',
  'campaign:manage',
  'report:marketing',
  'break_glass:use',
  'message:send',
  'notice:publish',
  'call_request:create',
  'meeting:create',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(value: string): value is Permission {
  return PERMISSIONS.some((code) => code === value);
}

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
