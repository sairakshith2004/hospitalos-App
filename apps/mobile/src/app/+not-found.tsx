import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ScreenContainer } from '@/components';
import { spacing, typography } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <EmptyState
            icon="alert"
            tone="warning"
            title="Page not found"
            message="This screen does not exist."
          />
          <Link href="/" accessibilityRole="link" style={styles.link}>
            <AppText variant="bodyStrong" color="primary">
              Go to dashboard
            </AppText>
          </Link>
        </View>
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  link: { ...typography.bodyStrong, padding: spacing.md },
});
