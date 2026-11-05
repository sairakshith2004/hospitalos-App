import type { IconName } from '@/components/Icon';

/**
 * The 11 staff roles of the reference permission model. `id` is this app's route-friendly name;
 * `code` is the reference role code used by the API and the permission matrix.
 */
export const ROLE_IDS = [
  'super-admin',
  'hospital-admin',
  'receptionist',
  'doctor',
  'nurse',
  'pharmacist',
  'lab-technician',
  'finance-manager',
  'hr-manager',
  'inventory-manager',
  'marketing-manager',
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

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

export type RoleDefinition = {
  id: RoleId;
  code: RoleCode;
  title: string;
  summary: string;
  icon: IconName;
};

export const ROLES: Record<RoleId, RoleDefinition> = {
  'super-admin': {
    id: 'super-admin',
    code: 'SA',
    title: 'Super Admin',
    summary: 'Head of the hospital: every permission, every department, role assignment',
    icon: 'shield',
  },
  'hospital-admin': {
    id: 'hospital-admin',
    code: 'ADM',
    title: 'Hospital Administrator',
    summary: 'Departments, doctors, schedules, nurse assignments, approvals and audit',
    icon: 'business',
  },
  receptionist: {
    id: 'receptionist',
    code: 'REC',
    title: 'Receptionist',
    summary: 'Patients, appointments, check-in, queue, bills and payments',
    icon: 'calendar',
  },
  doctor: {
    id: 'doctor',
    code: 'DOC',
    title: 'Doctor',
    summary: 'Own queue, consultations, prescriptions, lab orders and follow-ups',
    icon: 'medkit',
  },
  nurse: {
    id: 'nurse',
    code: 'NUR',
    title: 'Nurse',
    summary: 'My patients today: vitals and allergies for assigned sessions',
    icon: 'pulse',
  },
  pharmacist: {
    id: 'pharmacist',
    code: 'PHA',
    title: 'Pharmacist',
    summary: 'Prescription queue, dispensing, pharmacy stock and pharmacy bills',
    icon: 'clipboard',
  },
  'lab-technician': {
    id: 'lab-technician',
    code: 'LAB',
    title: 'Laboratory Technician',
    summary: 'Worklist, sample collection, results and verification',
    icon: 'flask',
  },
  'finance-manager': {
    id: 'finance-manager',
    code: 'FIN',
    title: 'Accountant / Finance Manager',
    summary: 'Invoices, payments, corrections, refunds, prices and expenses',
    icon: 'cash',
  },
  'hr-manager': {
    id: 'hr-manager',
    code: 'HR',
    title: 'HR Manager',
    summary: 'Staff and logins, attendance, leave decisions and notices',
    icon: 'briefcase',
  },
  'inventory-manager': {
    id: 'inventory-manager',
    code: 'INV',
    title: 'Inventory / Procurement Manager',
    summary: 'Store stock, suppliers, purchase orders and equipment',
    icon: 'cube',
  },
  'marketing-manager': {
    id: 'marketing-manager',
    code: 'MKT',
    title: 'Marketing Manager',
    summary: 'Enquiries, referrals, campaigns and aggregate reports',
    icon: 'megaphone',
  },
};

export function isRoleId(value: string): value is RoleId {
  return ROLE_IDS.some((id) => id === value);
}

export function findRoleByCode(code: RoleCode): RoleDefinition | undefined {
  return ROLE_IDS.map((id) => ROLES[id]).find((role) => role.code === code);
}
