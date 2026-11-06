import {
  currentUserSchema,
  signInResponseSchema,
  tokenPairSchema,
  z,
  type CurrentUser,
} from '@hospitalos/contracts';

import { ApiError, apiErrorFrom } from '../api/errors';

import type { TokenStore } from './token-store';

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export type SessionManagerOptions = Readonly<{
  baseUrl: string;
  store: TokenStore;
  transport?: Transport;
  appVersion: string;
  platform: 'android' | 'ios' | 'web';
  /** Called when the session can't continue (refresh failed): the app returns to sign-in. */
  onSessionEnded?: () => void;
}>;

/**
 * The only place that holds credentials (architecture §5.5).
 * - Access token: in memory only, in this closure.
 * - Refresh token: in SecureStore.
 * - Refresh is single-flight: concurrent 401s wait for one refresh and retry once, so the server
 *   never sees a spent refresh token from this app (which it would treat as theft).
 */
export function createSessionManager(options: SessionManagerOptions) {
  const transport: Transport = options.transport ?? ((url, init) => fetch(url, init));
  let accessToken: string | null = null;
  let refreshing: Promise<boolean> | null = null;

  const headers = (extra: Record<string, string> = {}) => ({
    Accept: 'application/json',
    'X-App-Version': options.appVersion,
    'X-App-Platform': options.platform,
    ...extra,
  });

  async function send(path: string, init: RequestInit): Promise<Response> {
    try {
      return await transport(`${options.baseUrl}${path}`, init);
    } catch {
      throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.');
    }
  }

  async function readJson(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text === '') return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'The server sent an unexpected answer.',
      );
    }
  }

  async function endLocally(): Promise<void> {
    accessToken = null;
    await options.store.clear();
  }

  async function doRefresh(): Promise<boolean> {
    const refreshToken = await options.store.read();
    if (!refreshToken) return false;
    const response = await send('/api/v1/auth/token', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      if (response.status === 401) await endLocally();
      return false;
    }
    const tokens = tokenPairSchema.parse(await readJson(response));
    accessToken = tokens.accessToken;
    await options.store.write(tokens.refreshToken);
    return true;
  }

  /** One refresh at a time; everyone waiting shares its result. */
  function refreshOnce(): Promise<boolean> {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  /** An authenticated request; the body is parsed with `schema`. */
  async function request<T extends z.ZodType>(
    path: string,
    schema: T,
    init: Readonly<{ method?: string; body?: unknown; headers?: Record<string, string> }> = {},
  ): Promise<z.infer<T>> {
    const attempt = async () => {
      if (accessToken === null && !(await refreshOnce())) {
        throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      }
      return send(path, {
        method: init.method ?? 'GET',
        headers: headers({
          Authorization: `Bearer ${accessToken ?? ''}`,
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        }),
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
    };
    let response = await attempt();
    if (response.status === 401) {
      accessToken = null;
      if (await refreshOnce()) response = await attempt();
      if (response.status === 401) {
        await endLocally();
        options.onSessionEnded?.();
      }
    }
    const body = await readJson(response);
    if (!response.ok) throw apiErrorFrom(response.status, body);
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'The server sent an unexpected answer.',
      );
    return parsed.data;
  }

  /** An unauthenticated request (sign-in, forgot and reset password). */
  async function publicRequest<T extends z.ZodType>(
    path: string,
    schema: T,
    body: unknown,
  ): Promise<z.infer<T>> {
    const response = await send(path, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const json = await readJson(response);
    if (!response.ok) throw apiErrorFrom(response.status, json);
    const parsed = schema.safeParse(json);
    if (!parsed.success)
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'The server sent an unexpected answer.',
      );
    return parsed.data;
  }

  return {
    request,
    publicRequest,

    async signIn(username: string, password: string, deviceLabel: string): Promise<CurrentUser> {
      const result = await publicRequest('/api/v1/auth/sessions', signInResponseSchema, {
        username,
        password,
        deviceLabel,
      });
      accessToken = result.accessToken;
      await options.store.write(result.refreshToken);
      return result.user;
    },

    /** App start: a stored refresh token brings the session back without a password. */
    async restore(): Promise<CurrentUser | null> {
      if (!(await options.store.read())) return null;
      try {
        if (!(await refreshOnce())) return null;
        return await request('/api/v1/auth/me', currentUserSchema);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NETWORK_ERROR') throw error;
        await endLocally();
        return null;
      }
    },

    me: () => request('/api/v1/auth/me', currentUserSchema),

    async signOut(): Promise<void> {
      try {
        if (accessToken !== null)
          await request('/api/v1/auth/sessions/current', z.null(), { method: 'DELETE' });
      } catch {
        // Signing out always ends the session on this device, even if the server can't be reached.
      } finally {
        await endLocally();
      }
    },

    hasAccessToken: () => accessToken !== null,
  };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
