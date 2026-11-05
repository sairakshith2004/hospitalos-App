import type { IconName } from '@/components/Icon';

/** The 11 staff roles in product scope. Order matches the product brief. */
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

export type RoleDefinition = {
  id: RoleId;
  title: string;
  summary: string;
  icon: IconName;
};

export const ROLES: Record<RoleId, RoleDefinition> = {
  'super-admin': {
    id: 'super-admin',
    title: 'Super Admin',
    summary: 'Platform configuration, hospitals and administrator accounts',
    icon: 'shield',
  },
  'hospital-admin': {
    id: 'hospital-admin',
    title: 'Hospital Administrator',
    summary: 'Operations, departments, staff access and system health',
    icon: 'business',
  },
  receptionist: {
    id: 'receptionist',
    title: 'Receptionist',
    summary: 'Registration, appointments and patient arrivals',
    icon: 'calendar',
  },
  doctor: {
    id: 'doctor',
    title: 'Doctor',
    summary: 'Assigned patients, encounters and clinical notes',
    icon: 'medkit',
  },
  nurse: {
    id: 'nurse',
    title: 'Nurse',
    summary: 'Assigned patients, observations and care tasks',
    icon: 'pulse',
  },
  pharmacist: {
    id: 'pharmacist',
    title: 'Pharmacist',
    summary: 'Prescription queue, dispensing and stock',
    icon: 'clipboard',
  },
  'lab-technician': {
    id: 'lab-technician',
    title: 'Lab Technician',
    summary: 'Samples, test orders and result entry',
    icon: 'flask',
  },
  'finance-manager': {
    id: 'finance-manager',
    title: 'Accountant / Finance Manager',
    summary: 'Invoices, payments and refund review',
    icon: 'cash',
  },
  'hr-manager': {
    id: 'hr-manager',
    title: 'HR Manager',
    summary: 'Staff directory, attendance and leave',
    icon: 'briefcase',
  },
  'inventory-manager': {
    id: 'inventory-manager',
    title: 'Inventory / Procurement Manager',
    summary: 'Stock, purchase orders and equipment maintenance',
    icon: 'cube',
  },
  'marketing-manager': {
    id: 'marketing-manager',
    title: 'Marketing Manager',
    summary: 'Enquiries, referrals and campaigns',
    icon: 'megaphone',
  },
};

export function isRoleId(value: string): value is RoleId {
  return ROLE_IDS.some((id) => id === value);
}
