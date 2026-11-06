import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, BrandMark, PrimaryButton, ScreenContainer } from '@/components';
import { layout, spacing } from '@/theme/tokens';

/** First screen when signed out: brand, one line of purpose, one action. */
export function SplashScreen() {
  const router = useRouter();
  return (
    <ScreenContainer scroll={false}>
      <View style={styles.center}>
        <BrandMark size="lg" />
        <View style={styles.text}>
          <AppText variant="overline" color="primary" style={styles.centerText}>
            HOSPITAL OPERATING SYSTEM
          </AppText>
          <AppText variant="display" accessibilityRole="header" style={styles.centerText}>
            HospitalOS
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.centerText}>
            Hospital operations, in one place.
          </AppText>
        </View>
      </View>
      <PrimaryButton
        label="Continue"
        fullWidth
        size="lg"
        onPress={() => router.replace('/onboarding')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  text: { gap: spacing.sm, maxWidth: layout.proseMaxWidth },
  centerText: { textAlign: 'center' },
});
