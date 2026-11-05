import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, PrimaryButton, ScreenContainer } from '@/components';
import { spacing } from '@/theme/tokens';

/** Placeholder. The branded splash with logo reveal is built in Step 6. */
export function SplashScreen() {
  const router = useRouter();
  return (
    <ScreenContainer scroll={false}>
      <View style={styles.center}>
        <AppText variant="display" accessibilityRole="header">
          HospitalOS
        </AppText>
        <AppText variant="bodySmall" color="textMuted">
          Hospital operations, in one place.
        </AppText>
        <PrimaryButton label="Continue" onPress={() => router.replace('/onboarding')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
});
