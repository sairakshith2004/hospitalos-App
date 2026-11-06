import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

import { SessionProvider } from '@/features/session/SessionProvider';
import type { SessionState } from '@/features/session/types';
import type { SessionManager } from '@/services/session/session-manager';

/** Session and query providers for component tests (no retries, nothing shared between tests). */
export function TestProviders({
  children,
  initialState,
  manager,
}: PropsWithChildren<{ initialState?: SessionState; manager?: SessionManager }>) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionProvider
        {...(initialState ? { initialState } : {})}
        {...(manager ? { manager } : {})}
      >
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
