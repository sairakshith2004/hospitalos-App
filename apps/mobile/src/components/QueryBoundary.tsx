import type { ReactNode } from 'react';

import { ApiError, describeError } from '@/services/api/errors';

import { ErrorState } from './ErrorState';
import { LoadingSkeleton } from './LoadingSkeleton';

type Props<T> = Readonly<{
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    data: T | undefined;
    refetch: () => unknown;
  };
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}>;

/**
 * Loading, offline, permission-denied, error (with retry) and data states for one server query.
 * Never shows invented data.
 */
export function QueryBoundary<T>({ query, children, loadingLabel = 'Loading' }: Props<T>) {
  if (query.isPending) return <LoadingSkeleton rows={3} accessibilityLabel={loadingLabel} />;
  if (query.isError || query.data === undefined) {
    const error = query.error;
    if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
      return <ErrorState variant="offline" onRetry={() => void query.refetch()} />;
    }
    if (error instanceof ApiError && error.status === 403) {
      return <ErrorState variant="forbidden" />;
    }
    return (
      <ErrorState
        title="Could not load"
        message={describeError(error)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <>{children(query.data)}</>;
}
