import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, PrimaryButton, ScreenContainer } from '@/components';
import { useSession } from '@/features/session/SessionProvider';
import { spacing } from '@/theme/tokens';

/** Placeholder. The three onboarding screens are built in Step 6. */
export function OnboardingScreen() {
  const router = useRouter();
  const { markIntroSeen } = useSession();
  return (
    <ScreenContainer scroll={false}>
      <View style={styles.center}>
        <AppText variant="title" accessibilityRole="header">
          Welcome to HospitalOS
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.text}>
          Secure staff access, role-based workspaces and connected hospital operations.
        </AppText>
        <PrimaryButton
          label="Get started"
          onPress={() => {
            markIntroSeen();
            router.replace('/sign-in');
          }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  text: { textAlign: 'center' },
});
