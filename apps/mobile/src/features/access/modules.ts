import type { IconName } from '@/components/Icon';

import { hasPermission, type Permission } from './permissions';

/**
 * Hospital modules. These are reached from the Home screen, never the tab bar, so the
 * bottom navigation stays at five stable destinations for every role.
 */
export const MODULE_IDS = [
  'reception',
  'clinical',
  'nursing',
  'pharmacy',
  'laboratory',
  'finance',
  'hr',
  'inventory',
  'administration',
  'marketing',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type ModuleDefinition = {
  id: ModuleId;
  title: string;
  icon: IconName;
  requires: Permission;
};

export const MODULES: readonly ModuleDefinition[] = [
  { id: 'reception', title: 'Reception', icon: 'calendar', requires: 'appointments.read' },
  { id: 'clinical', title: 'Clinical', icon: 'medkit', requires: 'clinical.read' },
  { id: 'nursing', title: 'Nursing', icon: 'pulse', requires: 'nursing.read' },
  { id: 'pharmacy', title: 'Pharmacy', icon: 'clipboard', requires: 'pharmacy.read' },
  { id: 'laboratory', title: 'Laboratory', icon: 'flask', requires: 'lab.read' },
  { id: 'finance', title: 'Finance', icon: 'cash', requires: 'finance.read' },
  { id: 'hr', title: 'HR', icon: 'briefcase', requires: 'hr.read' },
  { id: 'inventory', title: 'Inventory', icon: 'cube', requires: 'inventory.read' },
  { id: 'administration', title: 'Administration', icon: 'business', requires: 'admin.users.read' },
  { id: 'marketing', title: 'Marketing', icon: 'megaphone', requires: 'marketing.read' },
];

export function findModule(id: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.id === id);
}

export function visibleModules(granted: readonly Permission[]): ModuleDefinition[] {
  return MODULES.filter((module) => hasPermission(granted, module.requires));
}
