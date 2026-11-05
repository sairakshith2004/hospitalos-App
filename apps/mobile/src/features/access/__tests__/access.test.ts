import { findModule, MODULES, visibleModules } from '@/features/access/modules';
import { hasPermission } from '@/features/access/permissions';
import { isRoleId, ROLE_IDS, ROLES } from '@/features/access/roles';

describe('roles', () => {
  it('defines exactly the 11 product roles', () => {
    expect(ROLE_IDS).toHaveLength(11);
    for (const id of ROLE_IDS) expect(ROLES[id].id).toBe(id);
  });

  it('recognises only known role ids', () => {
    expect(isRoleId('doctor')).toBe(true);
    expect(isRoleId('root')).toBe(false);
  });
});

describe('permissions and modules', () => {
  it('denies by default', () => {
    expect(hasPermission([], 'finance.read')).toBe(false);
    expect(visibleModules([])).toEqual([]);
  });

  it('shows only modules whose permission is granted', () => {
    const ids = visibleModules(['pharmacy.read', 'inventory.read']).map((m) => m.id);
    expect(ids).toEqual(['pharmacy', 'inventory']);
  });

  it('finds modules by id', () => {
    expect(findModule('finance')?.title).toBe('Finance');
    expect(findModule('nope')).toBeUndefined();
    expect(MODULES.length).toBeLessThanOrEqual(10);
  });
});
