import {
  changePasswordRequestSchema,
  forgotPasswordResponseSchema,
  z,
  type CurrentUser,
} from '@hospitalos/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import type { RoleId } from '@/features/access/roles';
import { createDemoSession } from '@/features/dev/demo-session';
import { appSessionManager, deviceLabel, onSessionEnded } from '@/services/session/app-session';
import type { SessionManager } from '@/services/session/session-manager';

import type { AuthenticatedSession, Session, SessionState } from './types';

type SessionContextValue = {
  state: SessionState;
  /** False until the app has checked for a stored session at start-up. */
  ready: boolean;
  /** True once the user has passed splash/onboarding in this app run. */
  introSeen: boolean;
  markIntroSeen: () => void;
  signIn: (username: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (identifier: string) => Promise<void>;
  resetPassword: (identifier: string, code: string, newPassword: string) => Promise<void>;
  /** The authenticated session manager, for API calls. Null for demo sessions. */
  api: SessionManager | null;
  startDemoSession: (roleId: RoleId) => void;
  switchDemoRole: (roleId: RoleId) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type Props = PropsWithChildren<{ initialState?: SessionState; manager?: SessionManager }>;

export function toAuthenticatedSession(user: CurrentUser): AuthenticatedSession {
  return {
    kind: 'authenticated',
    userId: user.id,
    username: user.username,
    displayName: user.fullName,
    roles: user.roles,
    permissions: user.permissions,
    mustChangePassword: user.mustChangePassword,
  };
}

/**
 * Session state for the app. Server sessions come only from the API (sign-in or a restored refresh
 * token); their roles and permissions are exactly what `GET /api/v1/auth/me` returns (DO-4).
 * The development demo session never has a credential and never calls the API.
 */
export function SessionProvider({ children, initialState, manager }: Props) {
  const api = useMemo(() => manager ?? appSessionManager(), [manager]);
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>(initialState ?? { status: 'signed-out' });
  const [ready, setReady] = useState(initialState !== undefined);
  const [introSeen, setIntroSeen] = useState(false);
  const mounted = useRef(true);

  const endSession = useCallback(() => {
    queryClient.clear();
    setState({ status: 'signed-out' });
  }, [queryClient]);

  // App start: a stored refresh token brings the session back without asking for the password.
  useEffect(() => {
    mounted.current = true;
    if (initialState !== undefined) return;
    api
      .restore()
      .then((user) => {
        if (mounted.current && user) {
          setState({ status: 'signed-in', session: toAuthenticatedSession(user) });
          setIntroSeen(true);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setReady(true);
      });
    return () => {
      mounted.current = false;
    };
  }, [api, initialState]);

  useEffect(() => onSessionEnded(endSession), [endSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      ready,
      introSeen,
      api: state.status === 'signed-in' && state.session.kind === 'authenticated' ? api : null,
      markIntroSeen: () => setIntroSeen(true),
      async signIn(username, password) {
        const user = await api.signIn(username.trim(), password, deviceLabel());
        queryClient.clear();
        setState({ status: 'signed-in', session: toAuthenticatedSession(user) });
        setIntroSeen(true);
      },
      async changePassword(currentPassword, newPassword) {
        const body = changePasswordRequestSchema.parse({ currentPassword, newPassword });
        await api.request('/api/v1/auth/password', z.null(), { method: 'POST', body });
        const user = await api.me();
        setState({ status: 'signed-in', session: toAuthenticatedSession(user) });
      },
      async requestPasswordReset(identifier) {
        await api.publicRequest('/api/v1/auth/password/forgot', forgotPasswordResponseSchema, {
          identifier: identifier.trim(),
        });
      },
      async resetPassword(identifier, code, newPassword) {
        await api.publicRequest('/api/v1/auth/password/reset', z.null(), {
          identifier: identifier.trim(),
          code: code.trim(),
          newPassword,
        });
      },
      startDemoSession: (roleId) => {
        setState({ status: 'signed-in', session: createDemoSession(roleId) });
        // Anyone who reached a session is past the intro, so signing out returns to sign-in.
        setIntroSeen(true);
      },
      switchDemoRole: (roleId) =>
        setState((current) =>
          current.status === 'signed-in' && current.session.kind === 'demo'
            ? { status: 'signed-in', session: createDemoSession(roleId) }
            : current,
        ),
      async signOut() {
        if (state.status === 'signed-in' && state.session.kind === 'authenticated') {
          await api.signOut();
        }
        endSession();
      },
    }),
    [state, ready, introSeen, api, queryClient, endSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>.');
  return value;
}

/** For screens inside the protected (app) group, where a session is guaranteed by the router. */
export function useSignedInSession(): Session {
  const { state } = useSession();
  if (state.status !== 'signed-in') {
    throw new Error('useSignedInSession called outside the protected app area.');
  }
  return state.session;
}

/** The API for the signed-in server session. Throws for demo sessions (they never call the API). */
export function useApi(): SessionManager {
  const { api } = useSession();
  if (api === null) throw new Error('This screen needs a signed-in HospitalOS account.');
  return api;
}
