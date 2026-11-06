import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { ROLE_CODES, ROLE_IDS, ROLES, type RoleCode } from '@/features/access/roles';
import type * as DashboardContentModule from '@/features/dashboard/dashboard-content';
import type * as DemoDashboardModule from '@/features/dev/demo-dashboard';
import type { AuthenticatedSession, DemoSession } from '@/features/session/types';

function demoSession(role: RoleCode): DemoSession {
  const id = ROLE_IDS.find((roleId) => ROLES[roleId].code === role) ?? 'super-admin';
  return {
    kind: 'demo',
    displayName: `Demo ${ROLES[id].title}`,
    demoRoleId: id,
    roles: [role],
    permissions: ROLE_PERMISSIONS[role],
  };
}

const serverSession: AuthenticatedSession = {
  kind: 'authenticated',
  userId: 'user-1',
  username: 'server-user',
  mustChangePassword: false,
  displayName: 'Server User',
  roles: ['REC'],
  permissions: ROLE_PERMISSIONS.REC,
};

function load<T extends object>(path: string, devTools: boolean): T {
  let mod: T | undefined;
  jest.isolateModules(() => {
    jest.doMock('@/features/dev/flags', () => ({ devToolsEnabled: devTools }));
    mod = jest.requireActual<T>(path);
  });
  if (!mod) throw new Error(`could not load ${path}`);
  return mod;
}

afterEach(() => jest.dontMock('@/features/dev/flags'));

describe('dashboard content in development builds', () => {
  const { getDashboardContent } = load<typeof DashboardContentModule>(
    '@/features/dashboard/dashboard-content',
    true,
  );

  it.each(ROLE_CODES)('gives a %s demo session synthetic figures and tasks', (role) => {
    const content = getDashboardContent(demoSession(role));
    expect(content.kind).toBe('demo');
    if (content.kind !== 'demo') return;
    expect(content.dashboard.metrics.length).toBeGreaterThanOrEqual(2);
    expect(content.dashboard.tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('gives a server-issued session no demo figures (API pending)', () => {
    expect(getDashboardContent(serverSession)).toEqual({ kind: 'pending-api' });
  });
});

describe('dashboard content in production builds', () => {
  it('never returns demo figures, even for a demo-shaped session', () => {
    const { getDashboardContent } = load<typeof DashboardContentModule>(
      '@/features/dashboard/dashboard-content',
      false,
    );
    for (const role of ROLE_CODES) {
      expect(getDashboardContent(demoSession(role))).toEqual({ kind: 'pending-api' });
    }
  });

  it('has no demo dashboard to give', () => {
    const { getDemoDashboard } = load<typeof DemoDashboardModule>(
      '@/features/dev/demo-dashboard',
      false,
    );
    for (const role of ROLE_CODES) expect(getDemoDashboard(role)).toBeUndefined();
  });
});

describe('demo dashboard content rules', () => {
  const { getDemoDashboard } = load<typeof DemoDashboardModule>(
    '@/features/dev/demo-dashboard',
    true,
  );
  const text = ROLE_CODES.map((role) => JSON.stringify(getDemoDashboard(role))).join('\n');

  it('is about outpatient operations only', () => {
    expect(text).not.toMatch(/admit|admission|\bward|\bbeds?\b|\bicu\b|inpatient|discharge/i);
  });

  it('contains no patient identifiers or clinical details', () => {
    expect(text).not.toMatch(/\bMRN\s*\d|\bmrn\b|\+91|\b\d{10}\b|diagnos|\bmg\b/i);
  });
});
