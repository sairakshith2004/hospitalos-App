import { ErrorState } from './ErrorState';
import { ScreenContainer } from './ScreenContainer';

type Props = {
  error: Error;
  onRetry: () => void | Promise<void>;
};

/**
 * Root error screen. Error details are shown in development builds only, so internal
 * messages (which could one day contain record data) never reach end users.
 */
export function ErrorFallback({ error, onRetry }: Props) {
  return (
    <ScreenContainer scroll={false}>
      <ErrorState
        message="This screen could not be displayed. Try again, and contact support if it keeps happening."
        {...(__DEV__ ? { detail: error.message } : {})}
        onRetry={() => {
          void onRetry();
        }}
      />
    </ScreenContainer>
  );
}
