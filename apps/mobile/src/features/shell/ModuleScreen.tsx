import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState, GlassCard, ScreenContainer, ScreenHeader, StatusChip } from '@/components';
import { canSeeModule, findModule } from '@/features/access/modules';
import { useSignedInSession } from '@/features/session/SessionProvider';

/**
 * Module entry point. Shows not-found and permission-denied states, and otherwise states
 * honestly which release the module's screens arrive in. The API enforces access on every
 * request; this screen only decides what to show.
 */
export function ModuleScreen() {
  const router = useRouter();
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const session = useSignedInSession();
  const module = findModule(moduleId);

  if (!module) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Module not found" />
        <GlassCard padding="none">
          <EmptyState icon="alert" tone="warning" title="This module does not exist" />
        </GlassCard>
      </ScreenContainer>
    );
  }

  if (!canSeeModule(session, module)) {
    return (
      <ScreenContainer>
        <ScreenHeader title={module.title} />
        <GlassCard padding="none">
          <EmptyState
            icon="lock"
            tone="neutral"
            title="Not available for your role"
            message="Ask your administrator if you need access to this module."
          />
        </GlassCard>
      </ScreenContainer>
    );
  }

  const { release, detail } = module.availability;
  return (
    <ScreenContainer>
      <ScreenHeader title={module.title} />
      <StatusChip label={`ARRIVES IN ${release.toUpperCase()}`} tone="neutral" dot={false} />
      <GlassCard tone="hero" padding="none">
        <EmptyState
          icon={module.icon}
          title={`${module.title} arrives in ${release}`}
          message={
            detail
              ? `Planned for ${release} (${detail}). Nothing here is live yet.`
              : `Planned for ${release}. Nothing here is live yet.`
          }
          action={{ label: 'Open work queue', onPress: () => router.navigate('/queue') }}
        />
      </GlassCard>
    </ScreenContainer>
  );
}
