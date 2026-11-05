import { useLocalSearchParams } from 'expo-router';

import { EmptyState, ScreenContainer, ScreenHeader, StatusChip } from '@/components';
import { findModule } from '@/features/access/modules';
import { hasPermission } from '@/features/access/permissions';
import { useSignedInSession } from '@/features/session/SessionProvider';

/** Module entry point. Shows not-found and permission-denied states; content arrives in later steps. */
export function ModuleScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const session = useSignedInSession();
  const module = findModule(moduleId);

  if (!module) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Module not found" />
        <EmptyState icon="alert" title="This module does not exist" />
      </ScreenContainer>
    );
  }

  if (!hasPermission(session.permissions, module.requires)) {
    return (
      <ScreenContainer>
        <ScreenHeader title={module.title} />
        <EmptyState
          icon="lock"
          title="Not available for your role"
          message="Ask your administrator if you need access to this module."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={module.title} />
      <StatusChip label="DEMO DATA" tone="warning" dot={false} />
      <EmptyState
        icon={module.icon}
        title={`${module.title} is coming soon`}
        message="This module's screens are built in a later roadmap step."
      />
    </ScreenContainer>
  );
}
