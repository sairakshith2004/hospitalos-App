import { AppText, EmptyState, ScreenContainer, StatusChip } from '@/components';
import { ROLES } from '@/features/access/roles';
import { useSignedInSession } from '@/features/session/SessionProvider';

export function WorkQueueScreen() {
  const session = useSignedInSession();
  return (
    <ScreenContainer bottomInset={false}>
      <AppText variant="title" accessibilityRole="header">
        Work queue
      </AppText>
      <StatusChip label={ROLES[session.demoRoleId].title} tone="primary" dot={false} />
      <EmptyState
        icon="queue"
        title="Nothing assigned yet"
        message="Tasks assigned to your role will appear here. Role-specific queues arrive in Step 8."
      />
    </ScreenContainer>
  );
}
