import { AppText, EmptyState, ScreenContainer, StatusChip } from '@/components';
import { primaryRole } from '@/features/session/session-role';
import { useSignedInSession } from '@/features/session/SessionProvider';

export function WorkQueueScreen() {
  const session = useSignedInSession();
  return (
    <ScreenContainer bottomInset={false}>
      <AppText variant="title" accessibilityRole="header">
        Work queue
      </AppText>
      <StatusChip
        label={primaryRole(session)?.title ?? 'No role assigned'}
        tone="primary"
        dot={false}
      />
      <EmptyState
        icon="queue"
        title="Nothing assigned yet"
        message="Work for your role appears here once it comes from the hospital server, starting with the Release 1 workflows."
      />
    </ScreenContainer>
  );
}
