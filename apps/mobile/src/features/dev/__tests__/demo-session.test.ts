import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { ROLE_IDS, ROLES } from '@/features/access/roles';
import type * as DemoSessionModule from '@/features/dev/demo-session';

// Minimal local types: this project loads only Jest's global types, not Node's.
declare const __dirname: string;
type Entry = { name: string; isDirectory(): boolean };
const fs = jest.requireActual<{
  readdirSync(path: string, options: { withFileTypes: true }): Entry[];
  readFileSync(path: string, encoding: 'utf8'): string;
}>('fs');
const path = jest.requireActual<{ join(...segments: string[]): string }>('path');

const SRC = path.join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('createDemoSession', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('@/features/dev/flags');
  });

  it('creates a demo session for every role with exactly that role’s reference grants', () => {
    jest.isolateModules(() => {
      const { createDemoSession } = jest.requireActual<typeof DemoSessionModule>(
        '@/features/dev/demo-session',
      );
      for (const id of ROLE_IDS) {
        const session = createDemoSession(id);
        expect(session.kind).toBe('demo');
        expect(session.demoRoleId).toBe(id);
        expect(session.roles).toEqual([ROLES[id].code]);
        expect(session.permissions).toEqual(ROLE_PERMISSIONS[ROLES[id].code]);
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

describe('F0-5 the role preview cannot authorize API access', () => {
  it('carries no credential of any kind', () => {
    jest.isolateModules(() => {
      const { createDemoSession } = jest.requireActual<typeof DemoSessionModule>(
        '@/features/dev/demo-session',
      );
      const session = createDemoSession('super-admin');
      expect(Object.keys(session).sort()).toEqual(
        ['demoRoleId', 'displayName', 'kind', 'permissions', 'roles'].sort(),
      );
      expect(JSON.stringify(session)).not.toMatch(/token|secret|password|credential|bearer/i);
    });
  });

  it('keeps all network code in the session manager, which the demo session never reaches', () => {
    const files = sourceFiles(SRC);
    expect(files.length).toBeGreaterThan(50);
    const network = files.filter((file) =>
      /\bfetch\s*\(|XMLHttpRequest|\baxios\b|new WebSocket|EventSource/.test(
        fs.readFileSync(file, 'utf8'),
      ),
    );
    expect(network.map((file) => file.slice(SRC.length + 1))).toEqual([
      'services/session/session-manager.ts',
    ]);
    // The demo session and the role preview can't reach the API client or credentials.
    for (const file of files.filter((f) => f.includes('/features/dev/'))) {
      expect(`${file}\n${fs.readFileSync(file, 'utf8')}`).not.toMatch(
        /@\/services|SecureStore|Authorization/,
      );
    }
  });
});
