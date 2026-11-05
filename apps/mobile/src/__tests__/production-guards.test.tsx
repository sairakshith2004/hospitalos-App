import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { ROLE_PERMISSIONS } from '@/features/access/role-permissions';
import { HomeScreen } from '@/features/dashboard/HomeScreen';
import { SessionProvider } from '@/features/session/SessionProvider';

// Simulates a production build: development tools are switched off.
jest.mock('@/features/dev/flags', () => ({ devToolsEnabled: false }));

const APP_DIR = './src/app';

describe('F0-5 production configuration', () => {
  it('offers no demo path on the sign-in screen', async () => {
    renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    expect(await screen.findByText('Sign-in is not available yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open demo workspace' })).toBeNull();
  });

  it.each(['/role-preview', '/showcase'])('does not render %s', async (url) => {
    const result = renderRouter(APP_DIR, { initialUrl: url });
    await waitFor(() => expect(result.getPathname()).not.toBe(url));
    expect(screen.queryByText('DEVELOPMENT ONLY · NOT AUTHORIZATION')).toBeNull();
  });
});

describe('production configuration: dashboard', () => {
  it('shows no synthetic figures, even if a demo-shaped session existed', async () => {
    function Screen() {
      return (
        <SessionProvider
          initialState={{
            status: 'signed-in',
            session: {
              kind: 'demo',
              displayName: 'Demo Receptionist',
              demoRoleId: 'receptionist',
              roles: ['REC'],
              permissions: ROLE_PERMISSIONS.REC,
            },
          }}
        >
          <HomeScreen />
        </SessionProvider>
      );
    }
    renderRouter({ index: Screen }, { initialUrl: '/' });
    expect(await screen.findByText('No live figures yet')).toBeTruthy();
    expect(screen.queryByText('DEMO DATA')).toBeNull();
    expect(screen.queryByTestId('demo-figures')).toBeNull();
    expect(screen.queryByText('DEVELOPMENT PREVIEW')).toBeNull();
  });
});
