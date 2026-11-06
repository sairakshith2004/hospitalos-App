/**
 * The 11 staff roles of the reference HospitalOS permission model, in reference order.
 * The codes are what the API and database store; names are for display.
 */
export const ROLE_CODES = [
  'SA',
  'ADM',
  'REC',
  'DOC',
  'NUR',
  'PHA',
  'LAB',
  'FIN',
  'HR',
  'INV',
  'MKT',
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_NAMES: Readonly<Record<RoleCode, string>> = {
  SA: 'Super Admin',
  ADM: 'Hospital Administrator',
  REC: 'Receptionist',
  DOC: 'Doctor',
  NUR: 'Nurse',
  PHA: 'Pharmacist',
  LAB: 'Laboratory Technician',
  FIN: 'Accountant / Finance Manager',
  HR: 'HR Manager',
  INV: 'Inventory / Procurement Manager',
  MKT: 'Marketing Manager',
};

export function isRoleCode(value: string): value is RoleCode {
  return ROLE_CODES.some((code) => code === value);
}
