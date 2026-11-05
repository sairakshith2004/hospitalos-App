import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { RoleId } from '@/features/access/roles';
import { createDemoSession } from '@/features/dev/demo-session';

import type { Session, SessionState } from './types';

type SessionContextValue = {
  state: SessionState;
  /** True once the user has passed splash/onboarding in this app run (persisted in Step 6). */
  introSeen: boolean;
  markIntroSeen: () => void;
  startDemoSession: (roleId: RoleId) => void;
  switchDemoRole: (roleId: RoleId) => void;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type Props = PropsWithChildren<{ initialState?: SessionState }>;

/** In-memory session. Nothing is persisted and no credentials exist in this step. */
export function SessionProvider({ children, initialState = { status: 'signed-out' } }: Props) {
  const [state, setState] = useState<SessionState>(initialState);
  const [introSeen, setIntroSeen] = useState(false);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      introSeen,
      markIntroSeen: () => setIntroSeen(true),
      startDemoSession: (roleId) => {
        setState({ status: 'signed-in', session: createDemoSession(roleId) });
        // Anyone who reached a session is past the intro, so signing out returns to sign-in
        // (not splash/onboarding), even if they deep-linked straight to sign-in.
        setIntroSeen(true);
      },
      switchDemoRole: (roleId) =>
        setState((current) =>
          current.status === 'signed-in' && current.session.kind === 'demo'
            ? { status: 'signed-in', session: createDemoSession(roleId) }
            : current,
        ),
      signOut: () => setState({ status: 'signed-out' }),
    }),
    [state, introSeen],
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
