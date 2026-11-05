import { ROLE_IDS } from '@/features/access/roles';
import type * as DemoSessionModule from '@/features/dev/demo-session';

describe('createDemoSession', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/features/dev/flags');
  });

  it('creates a demo session for every role outside production', () => {
    jest.isolateModules(() => {
      const { createDemoSession } = jest.requireActual<typeof DemoSessionModule>(
        '@/features/dev/demo-session',
      );
      for (const id of ROLE_IDS) {
        const session = createDemoSession(id);
        expect(session.kind).toBe('demo');
        expect(session.demoRoleId).toBe(id);
        expect(session.permissions.length).toBeGreaterThan(0);
      }
    });
  });

  it('refuses to create a session in production builds', () => {
    jest.isolateModules(() => {
      jest.doMock('@/features/dev/flags', () => ({ devToolsEnabled: false }));
      const { createDemoSession, DemoModeUnavailableError } = jest.requireActual<
        typeof DemoSessionModule
      >('@/features/dev/demo-session');
      expect(() => createDemoSession('super-admin')).toThrow(DemoModeUnavailableError);
    });
  });
});
