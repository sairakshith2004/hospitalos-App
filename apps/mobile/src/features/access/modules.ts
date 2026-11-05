import type { IconName } from '@/components/Icon';

import { hasAnyPermission, type Permission } from './permissions';
import type { RoleCode } from './roles';

/**
 * Hospital modules. They open from the Home screen, never the tab bar, so the bottom navigation
 * stays at five stable destinations for every role.
 *
 * Visibility is DISPLAY ONLY. It decides which tiles appear; the API authorizes every action
 * again. Rules are in docs/MOBILE-IMPLEMENTATION-ROADMAP.md §3.1.
 */
export const MODULE_IDS = [
  'reception',
  'clinical',
  'nursing',
  'pharmacy',
  'laboratory',
  'billing',
  'administration',
  'finance',
  'inventory',
  'hr',
  'marketing',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

/** The release (and, inside Release 1, the phase) in which a module's screens arrive. */
export type ModuleAvailability = { release: string; detail?: string };

export type ModuleDefinition = {
  id: ModuleId;
  title: string;
  icon: IconName;
  /** Visible when the user holds at least one of these permissions. */
  anyOf: readonly Permission[];
  /**
   * Role workspaces that are shown by role rather than permission, because the permission alone
   * is shared with other roles (doctors also hold `vitals:record`). Still display only.
   */
  workspaceRoles?: readonly RoleCode[];
  availability: ModuleAvailability;
};

export const MODULES: readonly ModuleDefinition[] = [
  {
    id: 'reception',
    title: 'Reception',
    icon: 'calendar',
    anyOf: ['appointment:book', 'appointment:read_all'],
    availability: { release: 'Release 1', detail: 'phases 1.4 and 1.5' },
  },
  {
    id: 'clinical',
    title: 'Clinical',
    icon: 'medkit',
    anyOf: ['encounter:write'],
    availability: { release: 'Release 1', detail: 'phase 1.6' },
  },
  {
    id: 'nursing',
    title: 'Nursing',
    icon: 'pulse',
    anyOf: [],
    workspaceRoles: ['NUR', 'SA'],
    availability: { release: 'Release 1', detail: 'phase 1.6' },
  },
  {
    id: 'pharmacy',
    title: 'Pharmacy',
    icon: 'clipboard',
    anyOf: ['prescription:dispense', 'operations:oversee'],
    availability: { release: 'Release 1', detail: 'phase 1.7; stock in Release 4' },
  },
  {
    id: 'laboratory',
    title: 'Laboratory',
    icon: 'flask',
    anyOf: ['lab:process', 'lab_result:verify', 'operations:oversee'],
    availability: { release: 'Release 1', detail: 'phase 1.8' },
  },
  {
    id: 'billing',
    title: 'Billing',
    icon: 'cash',
    anyOf: ['invoice:read'],
    availability: { release: 'Release 1', detail: 'phase 1.9; corrections in Release 3' },
  },
  {
    id: 'administration',
    title: 'Administration',
    icon: 'business',
    anyOf: [
      'user:manage',
      'user_role:assign',
      'department:manage',
      'audit:read',
      'nurse_assignment:manage',
      'schedule:manage',
    ],
    availability: {
      release: 'Release 1',
      detail: 'staff accounts and nurse assignments; the rest in Release 2',
    },
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: 'briefcase',
    anyOf: ['report:finance', 'expense:create', 'credit_note:create'],
    availability: { release: 'Release 3' },
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: 'cube',
    anyOf: ['stock:adjust_store', 'po:create', 'po:approve', 'equipment:manage'],
    availability: { release: 'Release 4' },
  },
  {
    id: 'hr',
    title: 'HR',
    icon: 'people',
    anyOf: ['employee:read', 'user:create', 'leave:approve'],
    availability: { release: 'Release 5', detail: 'staff logins in Release 1' },
  },
  {
    id: 'marketing',
    title: 'Outreach',
    icon: 'megaphone',
    anyOf: ['enquiry:manage', 'campaign:manage', 'report:marketing'],
    availability: { release: 'Release 6' },
  },
];

/** What the module rules need to know about the signed-in user. */
export type AccessSubject = Readonly<{
  permissions: readonly Permission[];
  roles: readonly RoleCode[];
}>;

export function findModule(id: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.id === id);
}

export function canSeeModule(subject: AccessSubject, module: ModuleDefinition): boolean {
  if (hasAnyPermission(subject.permissions, module.anyOf)) return true;
  return module.workspaceRoles?.some((role) => subject.roles.includes(role)) ?? false;
}

export function visibleModules(subject: AccessSubject): ModuleDefinition[] {
  return MODULES.filter((module) => canSeeModule(subject, module));
}
