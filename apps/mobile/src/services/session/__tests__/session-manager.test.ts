import { z } from '@hospitalos/contracts';

import { ApiError } from '../../api/errors';
import { createSessionManager, type Transport } from '../session-manager';
import type { TokenStore } from '../token-store';

const token = (prefix: 'hos_at_' | 'hos_rt_', n: number) =>
  `${prefix}${String(n).padStart(43, 'x')}`;

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'asha',
  fullName: 'Asha Verma',
  employeeNo: 'EMP-1',
  departmentCode: 'ADMIN',
  designation: 'Receptionist',
  roles: ['REC'],
  permissions: ['patient:create'],
  mustChangePassword: false,
  isDemo: false,
};

function memoryStore(initial: string | null = null): TokenStore & { value: () => string | null } {
  let value = initial;
  return {
    value: () => value,
    read: () => Promise.resolve(value),
    write: (next) => {
      value = next;
      return Promise.resolve();
    },
    clear: () => {
      value = null;
      return Promise.resolve();
    },
  };
}

const json = (status: number, body: unknown) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const envelope = (code: string) => ({ error: { code, message: 'x', requestId: 'req-12345678' } });

/** A fake API that issues token N+1 on each refresh and accepts only the newest access token. */
function fakeServer() {
  let issued = 0;
  let currentAccess = '';
  let currentRefresh = '';
  const calls: { path: string; auth: string | null; body: unknown }[] = [];
  const transport: Transport = async (url, init) => {
    const path = new URL(url).pathname;
    const headers = new Headers(init.headers);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ path, auth: headers.get('Authorization'), body });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const pair = () => {
      issued += 1;
      currentAccess = token('hos_at_', issued);
      currentRefresh = token('hos_rt_', issued);
      return {
        accessToken: currentAccess,
        refreshToken: currentRefresh,
        accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      };
    };
    if (path === '/api/v1/auth/sessions') return json(201, { ...pair(), user });
    if (path === '/api/v1/auth/token') {
      return z.object({ refreshToken: z.string() }).parse(body).refreshToken === currentRefresh
        ? json(200, pair())
        : json(401, envelope('UNAUTHENTICATED'));
    }
    if (headers.get('Authorization') !== `Bearer ${currentAccess}`)
      return json(401, envelope('UNAUTHENTICATED'));
    if (path === '/api/v1/auth/sessions/current') return json(204, null);
    return json(200, user);
  };
  return {
    transport,
    calls,
    expireAccess: () => {
      currentAccess = 'expired';
    },
    revokeAll: () => {
      currentAccess = 'revoked';
      currentRefresh = 'revoked';
    },
  };
}

const options = (transport: Transport, store: TokenStore, onSessionEnded = jest.fn()) => ({
  baseUrl: 'https://api.test',
  store,
  transport,
  appVersion: '1.0.0',
  platform: 'android' as const,
  onSessionEnded,
});

describe('session manager', () => {
  it('signs in, keeps the refresh token in the store and the access token only in memory', async () => {
    const server = fakeServer();
    const store = memoryStore();
    const manager = createSessionManager(options(server.transport, store));
    await expect(manager.signIn('asha', 'secret', 'Pixel 8')).resolves.toMatchObject({
      username: 'asha',
    });
    expect(store.value()).toBe(token('hos_rt_', 1));
    expect(manager.hasAccessToken()).toBe(true);
    await manager.me();
    expect(server.calls.at(-1)?.auth).toBe(`Bearer ${token('hos_at_', 1)}`);
  });

  it('sends the app version and platform on every request', async () => {
    const seen: Headers[] = [];
    const server = fakeServer();
    const manager = createSessionManager(
      options((url, init) => {
        seen.push(new Headers(init.headers));
        return server.transport(url, init);
      }, memoryStore()),
    );
    await manager.signIn('asha', 'secret', 'Pixel 8');
    await manager.me();
    for (const headers of seen) {
      expect(headers.get('X-App-Version')).toBe('1.0.0');
      expect(headers.get('X-App-Platform')).toBe('android');
    }
  });

  it('refreshes once when several requests hit an expired access token at the same time', async () => {
    const server = fakeServer();
    const store = memoryStore();
    const manager = createSessionManager(options(server.transport, store));
    await manager.signIn('asha', 'secret', 'Pixel 8');
    server.expireAccess();
    const results = await Promise.all([manager.me(), manager.me(), manager.me(), manager.me()]);
    expect(results).toHaveLength(4);
    expect(server.calls.filter((c) => c.path === '/api/v1/auth/token')).toHaveLength(1);
    expect(store.value()).toBe(token('hos_rt_', 2));
  });

  it('ends the session locally when the refresh token is refused', async () => {
    const server = fakeServer();
    const store = memoryStore();
    const ended = jest.fn();
    const manager = createSessionManager(options(server.transport, store, ended));
    await manager.signIn('asha', 'secret', 'Pixel 8');
    server.revokeAll();
    await expect(manager.me()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(store.value()).toBeNull();
    expect(manager.hasAccessToken()).toBe(false);
    expect(ended).toHaveBeenCalled();
  });

  it('restores a session from a stored refresh token at app start', async () => {
    const server = fakeServer();
    const first = createSessionManager(options(server.transport, memoryStore()));
    await first.signIn('asha', 'secret', 'Pixel 8');
    const store = memoryStore(token('hos_rt_', 1));
    const second = createSessionManager(options(server.transport, store));
    await expect(second.restore()).resolves.toMatchObject({ username: 'asha' });
    expect(store.value()).toBe(token('hos_rt_', 2));
  });

  it('restores nothing without a stored token, and clears a token the server refuses', async () => {
    const server = fakeServer();
    expect(
      await createSessionManager(options(server.transport, memoryStore())).restore(),
    ).toBeNull();
    const stale = memoryStore(token('hos_rt_', 99));
    expect(await createSessionManager(options(server.transport, stale)).restore()).toBeNull();
    expect(stale.value()).toBeNull();
  });

  it('signs out on the server and always clears the device, even offline', async () => {
    const server = fakeServer();
    const store = memoryStore();
    const manager = createSessionManager(options(server.transport, store));
    await manager.signIn('asha', 'secret', 'Pixel 8');
    await manager.signOut();
    expect(server.calls.some((c) => c.path === '/api/v1/auth/sessions/current')).toBe(true);
    expect(store.value()).toBeNull();

    const offlineStore = memoryStore();
    let online = true;
    const flaky = createSessionManager(
      options(
        (url, init) =>
          online ? server.transport(url, init) : Promise.reject(new Error('offline')),
        offlineStore,
      ),
    );
    await flaky.signIn('asha', 'secret', 'Pixel 8');
    online = false;
    await flaky.signOut();
    expect(offlineStore.value()).toBeNull();
    expect(flaky.hasAccessToken()).toBe(false);
  });

  it('reports network failures and unexpected bodies as typed errors', async () => {
    const offline = createSessionManager(
      options(() => Promise.reject(new Error('offline')), memoryStore()),
    );
    await expect(offline.signIn('a', 'b', 'c')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    const odd = createSessionManager(
      options(() => Promise.resolve(json(201, { hello: 'world' })), memoryStore()),
    );
    const error = await odd.signIn('a', 'b', 'c').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
