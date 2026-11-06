import { EmptyState, GlassCard, GradientHeader, ScreenContainer, StatusChip } from '@/components';
import { primaryRole } from '@/features/session/session-role';
import { useSignedInSession } from '@/features/session/SessionProvider';

import { QueueHint, RoleQueues } from './RoleQueues';

export function WorkQueueScreen() {
  const session = useSignedInSession();
  return (
    <ScreenContainer bottomInset={false}>
      <GradientHeader
        eyebrow="TODAY · LIVE"
        title="Work queue"
        trailing={
          <StatusChip
            label={primaryRole(session)?.title ?? 'No role assigned'}
            tone="primary"
            dot={false}
          />
        }
      />
      {session.kind === 'authenticated' ? (
        <>
          <QueueHint />
          <RoleQueues permissions={session.permissions} roles={session.roles} />
        </>
      ) : (
        <GlassCard padding="none" elevation="low">
          <EmptyState
            icon="queue"
            title="Nothing assigned"
            message="Work comes from the hospital server for signed-in accounts. The demo workspace has no queue."
          />
        </GlassCard>
      )}
    </ScreenContainer>
  );
}
