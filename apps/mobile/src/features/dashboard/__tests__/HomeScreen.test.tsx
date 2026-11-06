import { renderRouter, screen, within } from 'expo-router/testing-library';

import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { HomeScreen } from '@/features/dashboard/HomeScreen';
import { TestProviders } from '@/test-support/providers';
import type { Session } from '@/features/session/types';
import { createSessionManager, type SessionManager } from '@/services/session/session-manager';

/** A signed-in session manager whose fake server answers the dashboard with known figures. */
async function serverManager(dashboard: unknown) {
  const reply = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  const token = (p: string) => `${p}${'x'.repeat(43)}`;
  const manager = createSessionManager({
    baseUrl: 'https://api.test',
    appVersion: '1.0.0',
    platform: 'android',
    store: {
      read: () => Promise.resolve(null),
      write: () => Promise.resolve(),
      clear: () => Promise.resolve(),
    },
    transport: (url) =>
      url.endsWith('/auth/sessions')
        ? reply(
            {
              accessToken: token('hos_at_'),
              refreshToken: token('hos_rt_'),
              accessExpiresAt: new Date().toISOString(),
              user: {
                id: '11111111-1111-4111-8111-111111111111',
                username: 'r',
                fullName: 'R',
                employeeNo: 'E',
                departmentCode: 'ADMIN',
                designation: 'Receptionist',
                roles: ['REC'],
                permissions: [],
                mustChangePassword: false,
                isDemo: false,
              },
            },
            201,
          )
        : reply(dashboard),
  });
  await manager.signIn('r', 'p', 'test');
  return manager;
}

function renderHome(session: Session, manager?: SessionManager) {
  function Screen() {
    return (
      <TestProviders
        initialState={{ status: 'signed-in', session }}
        {...(manager ? { manager } : {})}
      >
        <HomeScreen />
      </TestProviders>
    );
  }
  return renderRouter({ index: Screen }, { initialUrl: '/' });
}

const demo: Session = {
  kind: 'demo',
  displayName: 'Demo Receptionist',
  demoRoleId: 'receptionist',
  roles: ['REC'],
  permissions: ROLE_PERMISSIONS.REC,
};

const server: Session = {
  kind: 'authenticated',
  userId: 'user-1',
  username: 'server-user',
  mustChangePassword: false,
  displayName: 'Server Receptionist',
  roles: ['REC'],
  permissions: ROLE_PERMISSIONS.REC,
};

describe('Home dashboard (development build)', () => {
  it('labels every block of synthetic figures as DEMO DATA', async () => {
    renderHome(demo);
    const figures = await screen.findByTestId('demo-figures');
    expect(within(figures).getByText('DEMO DATA')).toBeTruthy();
    expect(within(figures).getByText('Appointments today')).toBeTruthy();
    expect(within(screen.getByTestId('demo-tasks')).getByText('DEMO DATA')).toBeTruthy();
    expect(screen.getByText('DEVELOPMENT PREVIEW')).toBeTruthy();
  });

  it('shows the server figures, and never demo figures, for a server-issued session', async () => {
    const manager = await serverManager({
      date: '2026-11-06',
      role: 'REC',
      metrics: [
        {
          key: 'appointments_today',
          label: "Today's appointments",
          value: 12,
          unit: 'count',
          hint: null,
        },
      ],
      tasks: [{ key: 'follow_ups_due', title: 'Follow-ups due or overdue', count: 3 }],
    });
    renderHome(server, manager);
    expect(await screen.findByText("Today's appointments")).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Follow-ups due or overdue')).toBeTruthy();
    expect(screen.queryByText('DEMO DATA')).toBeNull();
    expect(screen.queryByTestId('demo-figures')).toBeNull();
  });

  it('shows an error with retry, not invented figures, when the server cannot answer', async () => {
    renderHome(server, await serverManager({ unexpected: true }));
    expect(await screen.findByText('Could not load')).toBeTruthy();
    expect(screen.queryByText('DEMO DATA')).toBeNull();
  });

  it.each([demo, server])('never shows an invented system status', async (session) => {
    renderHome(session);
    await screen.findByText('Modules');
    expect(screen.queryByText(/systems operational/i)).toBeNull();
  });
});
