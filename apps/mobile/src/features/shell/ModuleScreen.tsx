import { useLocalSearchParams } from 'expo-router';

import { EmptyState, ScreenContainer, ScreenHeader, StatusChip } from '@/components';
import { canSeeModule, findModule } from '@/features/access/modules';
import { useSignedInSession } from '@/features/session/SessionProvider';

/**
 * Module entry point. Shows not-found and permission-denied states, and otherwise states
 * honestly which release the module's screens arrive in. The API enforces access on every
 * request; this screen only decides what to show.
 */
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

  if (!canSeeModule(session, module)) {
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

  const { release, detail } = module.availability;
  return (
    <ScreenContainer>
      <ScreenHeader title={module.title} />
      <StatusChip label={`ARRIVES IN ${release.toUpperCase()}`} tone="neutral" dot={false} />
      <EmptyState
        icon={module.icon}
        title={`${module.title} arrives in ${release}`}
        message={
          detail
            ? `Planned for ${release} (${detail}). Nothing here is live yet.`
            : `Planned for ${release}. Nothing here is live yet.`
        }
      />
    </ScreenContainer>
  );
}
