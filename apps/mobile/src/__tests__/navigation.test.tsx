import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

const APP_DIR = './src/app';

// The tab bar exposes items as role "tab" on Android and "button" on iOS (React Navigation
// uses "button" on iOS because VoiceOver handles "tab" poorly). Query the platform's role.
const TAB_ROLE = Platform.OS === 'ios' ? 'button' : 'tab';

function getTab(name: string) {
  return screen.getByRole(TAB_ROLE, { name });
}

function findTab(name: string) {
  return screen.findByRole(TAB_ROLE, { name });
}

async function openDemoWorkspace() {
  const result = renderRouter(APP_DIR, { initialUrl: '/sign-in' });
  fireEvent.press(await screen.findByRole('button', { name: 'Open demo workspace' }));
  await screen.findByText('Priority tasks');
  return result;
}

async function switchRole(title: string) {
  fireEvent.press(getTab('Profile'));
  fireEvent.press(await screen.findByText('Role preview'));
  fireEvent.press(await screen.findByText(title));
  fireEvent.press(await findTab('Home'));
}

describe('entry flow', () => {
  it('opens on the splash when signed out and walks to sign-in', async () => {
    const result = renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Get started' }));
    expect(await screen.findByText('Use the account your hospital gave you.')).toBeTruthy();
    expect(result.getPathname()).toBe('/sign-in');
  });

  it('opens the forgot-password screen and states no message is sent', async () => {
    renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    fireEvent.press(await screen.findByRole('button', { name: 'Forgot password' }));
    expect(await screen.findByRole('button', { name: 'Send code' })).toBeTruthy();
  });
});

describe('protected area', () => {
  it('does not render app screens while signed out', async () => {
    const result = renderRouter(APP_DIR, { initialUrl: '/profile' });
    await waitFor(() => expect(result.getPathname()).not.toBe('/profile'));
    expect(screen.queryByText('DEMO SESSION')).toBeNull();
  });

  it('enters the demo workspace from sign-in', async () => {
    const result = await openDemoWorkspace();
    expect(result.getPathname()).toBe('/home');
    expect(screen.getAllByText('Hospital Administrator').length).toBeGreaterThan(0);
  });

  it('shows the five conceptual tabs', async () => {
    await openDemoWorkspace();
    for (const name of ['Home', 'Work Queue', 'Search', 'Inbox', 'Profile']) {
      expect(getTab(name)).toBeTruthy();
    }
    fireEvent.press(getTab('Work Queue'));
    expect(await screen.findByText('Nothing assigned')).toBeTruthy();
  });

  it('signs out through the confirmation dialog', async () => {
    await openDemoWorkspace();
    fireEvent.press(getTab('Profile'));
    fireEvent.press(await screen.findByText('Sign out'));
    expect(await screen.findByText('Sign out?')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Use the account your hospital gave you.')).toBeTruthy();

    // The demo session is cleared: protected routes are no longer reachable.
    act(() => router.push('/profile'));
    await waitFor(() => expect(screen.queryByText('DEMO SESSION')).toBeNull());
    expect(screen.getByText('Use the account your hospital gave you.')).toBeTruthy();
  });

  it('cancels sign-out and stays signed in', async () => {
    const result = await openDemoWorkspace();
    fireEvent.press(getTab('Profile'));
    fireEvent.press(await screen.findByText('Sign out'));
    fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(result.getPathname()).toBe('/profile'));
    expect(screen.getByText('DEMO SESSION')).toBeTruthy();
  });
});

describe('F0-4 inbox', () => {
  it('replaces Notifications and shows only the labelled placeholder', async () => {
    const result = await openDemoWorkspace();
    expect(screen.queryByText('Notifications')).toBeNull();
    fireEvent.press(getTab('Inbox'));
    expect(await screen.findByText('Your inbox arrives in Release 7')).toBeTruthy();
    expect(screen.getByText('ARRIVES IN RELEASE 7')).toBeTruthy();
    expect(result.getPathname()).toBe('/inbox');
  });

  it('no longer has a notifications route', async () => {
    // Navigated inside the app: incoming links never reach not-found (the link guard sends them
    // to the entry point instead).
    renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    await screen.findByText('Use the account your hospital gave you.');
    // @ts-expect-error -- typed routes reject '/notifications' at compile time; this checks run time.
    act(() => router.push('/notifications'));
    expect(await screen.findByText('Page not found')).toBeTruthy();
  });
});

describe('development role preview', () => {
  it('lists all 11 roles and switches the workspace', async () => {
    await openDemoWorkspace();
    fireEvent.press(getTab('Profile'));
    fireEvent.press(await screen.findByText('Role preview'));
    expect(await screen.findByText('DEVELOPMENT ONLY · NOT AUTHORIZATION')).toBeTruthy();
    expect(screen.getAllByTestId(/^role-/)).toHaveLength(11);

    fireEvent.press(screen.getByText('Doctor'));
    fireEvent.press(await findTab('Home'));
    expect(await screen.findByRole('button', { name: 'Clinical module' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finance module' })).toBeNull();
  });

  it('shows permission-denied and not-found module states', async () => {
    await openDemoWorkspace();
    await switchRole('Receptionist');
    fireEvent.press(await screen.findByRole('button', { name: 'Reception module' }));
    expect(await screen.findByText('Reception arrives in Release 1')).toBeTruthy();

    act(() => router.push('/modules/finance'));
    expect(await screen.findByText('Not available for your role')).toBeTruthy();
    expect(screen.queryByText('Finance arrives in Release 3')).toBeNull();

    act(() => router.push('/modules/does-not-exist'));
    expect(await screen.findByText('This module does not exist')).toBeTruthy();
  });
});

describe('unknown routes', () => {
  it('renders not-found for in-app navigation', async () => {
    renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    await screen.findByText('Use the account your hospital gave you.');
    // @ts-expect-error -- typed routes reject unknown paths at compile time; this checks run time.
    act(() => router.push('/does-not-exist'));
    expect(await screen.findByText('Page not found')).toBeTruthy();
  });
});

describe('incoming links (link guard, AD-M-017)', () => {
  it.each(['/does-not-exist', '/notifications', '/role-preview', '/sign-out', '/showcase'])(
    'an incoming link to %s opens the normal entry point instead',
    async (initialUrl) => {
      const result = renderRouter(APP_DIR, { initialUrl });
      expect(await screen.findByRole('button', { name: 'Continue' })).toBeTruthy();
      expect(result.getPathname()).toBe('/splash');
    },
  );

  it('an incoming link to an allowed destination opens it', async () => {
    const result = renderRouter(APP_DIR, { initialUrl: '/forgot-password' });
    expect(await screen.findByRole('button', { name: 'Send code' })).toBeTruthy();
    expect(result.getPathname()).toBe('/forgot-password');
  });

  it('an incoming link to a signed-in screen still requires a session', async () => {
    const result = renderRouter(APP_DIR, { initialUrl: '/home' });
    await waitFor(() => expect(result.getPathname()).not.toBe('/home'));
    expect(screen.queryByText('Priority tasks')).toBeNull();
  });
});
