import { useRouter } from 'expo-router';

import {
  AppText,
  Banner,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SurfaceCard,
} from '@/components';
import { devToolsEnabled } from '@/features/dev/flags';
import { useSession } from '@/features/session/SessionProvider';

/** Placeholder. The sign-in form, validation and states are built in Step 7. */
export function SignInScreen() {
  const router = useRouter();
  const { startDemoSession } = useSession();

  return (
    <ScreenContainer>
      <AppText variant="title" accessibilityRole="header">
        Sign in
      </AppText>
      <Banner
        tone="neutral"
        title="Sign-in is not available yet"
        message="Real accounts arrive with the HospitalOS API. No credentials are stored on this device."
      />
      <SecondaryButton label="Forgot password" onPress={() => router.push('/forgot-password')} />

      {devToolsEnabled ? (
        <SurfaceCard>
          <Banner
            title="DEVELOPMENT ONLY"
            message="Opens a demo workspace with synthetic data. This is not a login and grants no real access."
          />
          <PrimaryButton
            label="Open demo workspace"
            fullWidth
            onPress={() => startDemoSession('hospital-admin')}
          />
        </SurfaceCard>
      ) : null}
    </ScreenContainer>
  );
}
