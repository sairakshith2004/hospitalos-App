import { renderRouter, screen, within } from 'expo-router/testing-library';

import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { HomeScreen } from '@/features/dashboard/HomeScreen';
import { SessionProvider } from '@/features/session/SessionProvider';
import type { Session } from '@/features/session/types';

function renderHome(session: Session) {
  function Screen() {
    return (
      <SessionProvider initialState={{ status: 'signed-in', session }}>
        <HomeScreen />
      </SessionProvider>
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

  it('shows an honest empty state, and no demo figures, for a server-issued session', async () => {
    renderHome(server);
    expect(await screen.findByText('No live figures yet')).toBeTruthy();
    expect(screen.getByText('No tasks yet')).toBeTruthy();
    expect(screen.queryByText('DEMO DATA')).toBeNull();
    expect(screen.queryByTestId('demo-figures')).toBeNull();
    expect(screen.queryByText('Appointments today')).toBeNull();
  });

  it.each([demo, server])('never shows an invented system status', async (session) => {
    renderHome(session);
    await screen.findByText('Modules');
    expect(screen.queryByText(/systems operational/i)).toBeNull();
  });
});
