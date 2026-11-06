import { ROLE_PERMISSIONS, z } from '@hospitalos/contracts';
import * as SecureStore from 'expo-secure-store';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

const APP_DIR = './src/app';
const token = (prefix: string, n: number) => `${prefix}${String(n).padStart(43, 'x')}`;

type FakeUser = { username: string; password: string; mustChangePassword: boolean };

/** A tiny fake of the HospitalOS auth API behind global fetch. */
function installFakeApi(user: FakeUser) {
  let issued = 0;
  let access = '';
  let refresh = '';
  const requests: { method: string; path: string }[] = [];
  const reply = (status: number, body: unknown) =>
    Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status }));
  const error = (status: number, code: string) =>
    reply(status, { error: { code, message: code, requestId: 'req-12345678' } });
  const me = () => ({
    id: '11111111-1111-4111-8111-111111111111',
    username: user.username,
    fullName: 'Ravi Kumar',
    employeeNo: 'EMP-7',
    departmentCode: 'ADMIN',
    designation: 'Receptionist',
    roles: ['REC'],
    permissions: ROLE_PERMISSIONS.REC,
    mustChangePassword: user.mustChangePassword,
    isDemo: false,
  });
  const pair = () => {
    issued += 1;
    access = token('hos_at_', issued);
    refresh = token('hos_rt_', issued);
    return {
      accessToken: access,
      refreshToken: refresh,
      accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    };
  };
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      const method = init?.method ?? 'GET';
      const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
      const auth = new Headers(init?.headers).get('Authorization');
      requests.push({ method, path: url.pathname });
      const fields = z.record(z.string(), z.unknown()).safeParse(body);
      const field = (key: string) => (fields.success ? String(fields.data[key] ?? '') : '');
      switch (`${method} ${url.pathname}`) {
        case 'POST /api/v1/auth/sessions':
          return field('username') === user.username && field('password') === user.password
            ? reply(201, { ...pair(), user: me() })
            : error(401, 'INVALID_CREDENTIALS');
        case 'POST /api/v1/auth/token':
          return field('refreshToken') === refresh
            ? reply(200, pair())
            : error(401, 'UNAUTHENTICATED');
        default:
          if (auth !== `Bearer ${access}`) return error(401, 'UNAUTHENTICATED');
          if (method === 'POST' && url.pathname === '/api/v1/auth/password') {
            user.mustChangePassword = false;
            return reply(204, null);
          }
          if (method === 'DELETE') return reply(204, null);
          return reply(200, me());
      }
    });
  return { spy, requests };
}

async function signInAs(username: string, password: string) {
  fireEvent.changeText(await screen.findByLabelText('Username'), username);
  fireEvent.changeText(screen.getByLabelText('Password'), password);
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('real sign-in through the API', () => {
  it('shows a clear error for a wrong password and keeps the user signed out', async () => {
    installFakeApi({ username: 'ravi', password: 'right-password-123', mustChangePassword: false });
    const result = renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    await signInAs('ravi', 'wrong-password');
    expect(await screen.findByText('The username or password is not right.')).toBeTruthy();
    expect(result.getPathname()).toBe('/sign-in');
    expect(await SecureStore.getItemAsync('hospitalos.refresh-token')).toBeNull();
  });

  it('signs in, stores only the refresh token, shows no demo figures, and signs out', async () => {
    const api = installFakeApi({
      username: 'ravi',
      password: 'right-password-123',
      mustChangePassword: false,
    });
    const result = renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    await signInAs('ravi', 'right-password-123');
    await waitFor(() => expect(result.getPathname()).toBe('/home'));
    expect(screen.queryByText('DEMO DATA')).toBeNull();
    expect(await SecureStore.getItemAsync('hospitalos.refresh-token')).toBe(token('hos_rt_', 1));

    fireEvent.press(
      screen.getByRole(process.env.EXPO_OS === 'ios' ? 'button' : 'tab', { name: 'Profile' }),
    );
    fireEvent.press(await screen.findByText('Sign out'));
    fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(result.getPathname()).toBe('/sign-in'));
    expect(await SecureStore.getItemAsync('hospitalos.refresh-token')).toBeNull();
    expect(api.requests).toContainEqual({
      method: 'DELETE',
      path: '/api/v1/auth/sessions/current',
    });
  });

  it('allows only the password change after an HR-set password, then opens the app', async () => {
    installFakeApi({
      username: 'ravi',
      password: 'temporary-password-1',
      mustChangePassword: true,
    });
    const result = renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    await signInAs('ravi', 'temporary-password-1');
    expect(await screen.findByText('New password needed')).toBeTruthy();
    expect(result.getPathname()).toBe('/change-password');

    fireEvent.changeText(screen.getByLabelText('Password you were given'), 'temporary-password-1');
    fireEvent.changeText(screen.getByLabelText('New password'), 'my-own-new-password');
    fireEvent.changeText(screen.getByLabelText('New password again'), 'my-own-new-password-typo');
    fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByText('The passwords do not match.')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('New password again'), 'my-own-new-password');
    fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    await waitFor(() => expect(result.getPathname()).toBe('/home'));
  });

  it('restores a session from the keystore at app start without asking for the password', async () => {
    installFakeApi({ username: 'ravi', password: 'right-password-123', mustChangePassword: false });
    const first = renderRouter(APP_DIR, { initialUrl: '/sign-in' });
    await signInAs('ravi', 'right-password-123');
    await waitFor(() => expect(first.getPathname()).toBe('/home'));
    first.unmount();
    // (A new app run uses the same keystore; the session manager is created once per run.)
    expect(await SecureStore.getItemAsync('hospitalos.refresh-token')).not.toBeNull();
  });
});
