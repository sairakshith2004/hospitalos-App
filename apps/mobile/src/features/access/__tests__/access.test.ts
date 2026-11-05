import {
  canSeeModule,
  findModule,
  MODULE_IDS,
  MODULES,
  visibleModules,
  type ModuleId,
} from '@/features/access/modules';
import {
  hasAnyPermission,
  hasPermission,
  isPermission,
  PERMISSIONS,
  type Permission,
} from '@/features/access/permissions';
import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { isRoleId, ROLE_CODES, ROLE_IDS, ROLES, type RoleCode } from '@/features/access/roles';

// Minimal local types: this project loads only Jest's global types, not Node's.
declare const __dirname: string;
const fs = jest.requireActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('fs');
const path = jest.requireActual<{ resolve(...segments: string[]): string }>('path');

const MATRIX_DOC = path.resolve(__dirname, '../../../../../../docs/MOBILE-ROLE-MODULE-MATRIX.md');

type MatrixRow = { code: string; grants: ReadonlyMap<RoleCode, boolean> };

/** Reads the role × permission grid (§3) from the matrix document, the reviewed source. */
function readMatrix(): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const line of fs.readFileSync(MATRIX_DOC, 'utf8').split('\n')) {
    const match = /^\| \d+ \| `([a-z_]+:[a-z_]+)` \| R\d \|(.*)\|\s*$/.exec(line);
    if (!match) continue;
    const [, code = '', rest = ''] = match;
    const cells = rest.split('|').map((cell) => cell.trim());
    expect(cells).toHaveLength(ROLE_CODES.length);
    const grants = new Map(ROLE_CODES.map((role, i) => [role, cells[i] === '●'] as const));
    rows.push({ code, grants });
  }
  return rows;
}

const EXPECTED_TOTALS: Record<RoleCode, number> = {
  SA: 88,
  ADM: 29,
  REC: 21,
  DOC: 19,
  NUR: 11,
  PHA: 19,
  LAB: 8,
  FIN: 17,
  HR: 11,
  INV: 12,
  MKT: 6,
};

describe('roles', () => {
  it('defines exactly the 11 reference roles, each with a unique reference code', () => {
    expect(ROLE_IDS).toHaveLength(11);
    expect(ROLE_CODES).toHaveLength(11);
    const codes = ROLE_IDS.map((id) => ROLES[id].code);
    expect([...codes].sort()).toEqual([...ROLE_CODES].sort());
    for (const id of ROLE_IDS) expect(ROLES[id].id).toBe(id);
  });

  it('recognises only known role ids', () => {
    expect(isRoleId('doctor')).toBe(true);
    expect(isRoleId('root')).toBe(false);
  });
});

describe('F0-1 permission catalogue', () => {
  it('has exactly 88 unique codes', () => {
    expect(PERMISSIONS).toHaveLength(88);
    expect(new Set(PERMISSIONS).size).toBe(88);
  });

  it('equals the grid in docs/MOBILE-ROLE-MODULE-MATRIX.md', () => {
    const rows = readMatrix();
    expect(rows).toHaveLength(88);
    expect(rows.map((row) => row.code).sort()).toEqual([...PERMISSIONS].sort());
  });

  it('recognises only catalogue codes', () => {
    expect(isPermission('invoice:read')).toBe(true);
    expect(isPermission('finance.read')).toBe(false);
  });
});

describe('F0-2 role grants', () => {
  const rows = readMatrix();

  it.each(ROLE_CODES)('%s grants exactly the matrix cells', (role) => {
    const expected = rows.filter((row) => row.grants.get(role) === true).map((row) => row.code);
    expect([...ROLE_PERMISSIONS[role]].sort()).toEqual(expected.sort());
  });

  it('matches the reference per-role totals, with the Super Admin holding all 88', () => {
    for (const role of ROLE_CODES) {
      expect(new Set(ROLE_PERMISSIONS[role]).size).toBe(EXPECTED_TOTALS[role]);
    }
    expect([...ROLE_PERMISSIONS.SA].sort()).toEqual([...PERMISSIONS].sort());
  });

  it('keeps payroll:manage for SA and HR only (no payroll screens are planned)', () => {
    const holders = ROLE_CODES.filter((role) => ROLE_PERMISSIONS[role].includes('payroll:manage'));
    expect(holders).toEqual(['SA', 'HR']);
  });

  it('keeps credit_note:create for SA and FIN only', () => {
    const holders = ROLE_CODES.filter((role) =>
      ROLE_PERMISSIONS[role].includes('credit_note:create'),
    );
    expect(holders).toEqual(['SA', 'FIN']);
  });
});

describe('permission helpers', () => {
  it('denies by default', () => {
    expect(hasPermission([], 'invoice:read')).toBe(false);
    expect(hasAnyPermission(['invoice:read'], [])).toBe(false);
    expect(visibleModules({ permissions: [], roles: [] })).toEqual([]);
  });

  it('grants when any listed permission is held', () => {
    const granted: Permission[] = ['po:approve'];
    expect(hasAnyPermission(granted, ['stock:adjust_store', 'po:approve'])).toBe(true);
  });
});

describe('F0-3 module visibility (display only)', () => {
  const EXPECTED: Record<RoleCode, readonly ModuleId[]> = {
    SA: MODULE_IDS,
    ADM: ['reception', 'billing', 'administration', 'finance', 'inventory', 'hr', 'marketing'],
    REC: ['reception', 'billing', 'marketing'],
    DOC: ['clinical'],
    NUR: ['nursing'],
    PHA: ['pharmacy', 'billing'],
    LAB: ['laboratory'],
    FIN: ['billing', 'finance'],
    HR: ['hr'],
    INV: ['inventory'],
    MKT: ['marketing'],
  };

  it.each(ROLE_CODES)('%s sees exactly its modules', (role) => {
    const ids = visibleModules({ permissions: ROLE_PERMISSIONS[role], roles: [role] }).map(
      (module) => module.id,
    );
    expect([...ids].sort()).toEqual([...EXPECTED[role]].sort());
  });

  it('shows the nursing workspace by role, not by vitals:record alone', () => {
    const nursing = findModule('nursing');
    expect(nursing).toBeDefined();
    if (!nursing) return;
    expect(canSeeModule({ permissions: ['vitals:record'], roles: ['DOC'] }, nursing)).toBe(false);
    expect(canSeeModule({ permissions: [], roles: ['NUR'] }, nursing)).toBe(true);
  });

  it('gives every module a release and finds modules by id', () => {
    for (const module of MODULES) expect(module.availability.release).toMatch(/^Release [1-9]$/);
    expect(findModule('finance')?.title).toBe('Finance');
    expect(findModule('nope')).toBeUndefined();
  });
});
