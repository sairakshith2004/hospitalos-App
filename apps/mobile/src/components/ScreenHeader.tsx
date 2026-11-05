import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  title: string;
  subtitle?: string;
  /** Show a back button (default true). Android hardware back works regardless. */
  back?: boolean;
  trailing?: ReactNode;
};

/** In-content header for stack screens. Navigation headers are hidden app-wide. */
export function ScreenHeader({ title, subtitle, back = true, trailing }: Props) {
  const router = useRouter();
  return (
    <View style={styles.root}>
      {back ? (
        <IconButton
          icon="chevron-left"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
        />
      ) : null}
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle !== undefined ? (
          <AppText variant="bodySmall" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget,
  },
  text: { flex: 1, gap: spacing.xxs },
});
