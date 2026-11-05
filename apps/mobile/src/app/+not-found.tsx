import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.root}>
        <Text style={styles.title} accessibilityRole="header">
          Page not found
        </Text>
        <Text style={styles.body}>This screen does not exist.</Text>
        <Link href="/" style={styles.link} accessibilityRole="link">
          Go to dashboard
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600', padding: spacing.md },
});
