import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLE_PERMISSIONS, isPermission } from '../permissions';
import { ROLE_CODES, ROLE_NAMES, isRoleCode, type RoleCode } from '../roles';

const ROOT = resolve(import.meta.dirname, '../../../..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** Reference per-role totals (docs/MOBILE-ROLE-MODULE-MATRIX.md). */
const EXPECTED_TOTALS: Readonly<Record<RoleCode, number>> = {
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

/** Reads the role × permission grid from the reviewed matrix document. */
function matrixGrants(): Map<string, Set<RoleCode>> {
  const grid = new Map<string, Set<RoleCode>>();
  for (const line of read('docs/MOBILE-ROLE-MODULE-MATRIX.md').split('\n')) {
    const match = /^\| \d+ \| `([a-z_]+:[a-z_]+)` \| R\d \|(.*)\|\s*$/.exec(line);
    if (!match) continue;
    const [, code = '', rest = ''] = match;
    const cells = rest.split('|').map((cell) => cell.trim());
    grid.set(code, new Set(ROLE_CODES.filter((_, i) => cells[i] === '●')));
  }
  return grid;
}

/** Extracts the codes listed in one block of a TypeScript source file. */
function codesIn(source: string): string[] {
  return [...source.matchAll(/'([a-z_]+:[a-z_]+)'/g)].map((m) => m[1] ?? '');
}

describe('roles', () => {
  it('has exactly the 11 reference role codes, each with a name', () => {
    expect(ROLE_CODES).toHaveLength(11);
    expect(new Set(ROLE_CODES).size).toBe(11);
    for (const code of ROLE_CODES) expect(ROLE_NAMES[code]).toBeTruthy();
    expect(isRoleCode('DOC')).toBe(true);
    expect(isRoleCode('ROOT')).toBe(false);
  });
});

describe('permission catalogue', () => {
  it('has exactly 88 unique codes', () => {
    expect(PERMISSIONS).toHaveLength(88);
    expect(new Set(PERMISSIONS).size).toBe(88);
    expect(isPermission('invoice:read')).toBe(true);
    expect(isPermission('finance.read')).toBe(false);
  });

  it('matches the reviewed matrix document exactly', () => {
    const grid = matrixGrants();
    expect([...grid.keys()].sort()).toEqual([...PERMISSIONS].sort());
    for (const role of ROLE_CODES) {
      const expected = [...grid].filter(([, roles]) => roles.has(role)).map(([code]) => code);
      expect([...ROLE_PERMISSIONS[role]].sort(), role).toEqual(expected.sort());
    }
  });

  it('matches the reference per-role totals; the Super Admin holds all 88', () => {
    for (const role of ROLE_CODES) {
      expect(new Set(ROLE_PERMISSIONS[role]).size, role).toBe(EXPECTED_TOTALS[role]);
    }
    expect(ROLE_PERMISSIONS.SA).toEqual(PERMISSIONS);
  });

  it('keeps the separation-of-duties holders from the reference', () => {
    const holders = (code: (typeof PERMISSIONS)[number]) =>
      ROLE_CODES.filter((role) => ROLE_PERMISSIONS[role].includes(code));
    expect(holders('credit_note:create')).toEqual(['SA', 'FIN']);
    expect(holders('user_role:assign')).toEqual(['SA']);
    expect(holders('user:create')).toEqual(['SA', 'HR']);
    expect(holders('payroll:manage')).toEqual(['SA', 'HR']);
  });
});

describe('the mobile app uses this package (no second catalogue)', () => {
  it('re-exports the permissions and role grants instead of keeping a copy', () => {
    const permissions = read('apps/mobile/src/features/access/permissions.ts');
    const grants = read('apps/mobile/src/features/access/role-permissions.ts');
    expect(permissions).toContain("from '@hospitalos/contracts'");
    expect(grants).toContain("export { ROLE_PERMISSIONS } from '@hospitalos/contracts';");
    // No literal permission codes in the app's access files.
    expect(codesIn(permissions)).toEqual([]);
    expect(codesIn(grants)).toEqual([]);
  });
});
