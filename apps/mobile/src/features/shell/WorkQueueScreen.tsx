import { AppText, EmptyState, ScreenContainer, StatusChip } from '@/components';
import { primaryRole } from '@/features/session/session-role';
import { useSignedInSession } from '@/features/session/SessionProvider';

import { QueueHint, RoleQueues } from './RoleQueues';

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
      {session.kind === 'authenticated' ? (
        <>
          <QueueHint />
          <RoleQueues permissions={session.permissions} roles={session.roles} />
        </>
      ) : (
        <EmptyState
          icon="queue"
          title="Nothing assigned"
          message="Work comes from the hospital server for signed-in accounts. The demo workspace has no queue."
        />
      )}
    </ScreenContainer>
  );
}
