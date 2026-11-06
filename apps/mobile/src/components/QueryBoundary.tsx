import type { ReactNode } from 'react';

import { describeError } from '@/services/api/errors';

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

/** Loading, error (with retry) and data states for one server query. Never shows invented data. */
export function QueryBoundary<T>({ query, children, loadingLabel = 'Loading' }: Props<T>) {
  if (query.isPending) return <LoadingSkeleton rows={3} accessibilityLabel={loadingLabel} />;
  if (query.isError || query.data === undefined) {
    return (
      <ErrorState
        title="Could not load"
        message={describeError(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  return <>{children(query.data)}</>;
}
