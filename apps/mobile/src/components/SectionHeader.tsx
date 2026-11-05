import { Pressable, StyleSheet, View } from 'react-native';

import { layout, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  title: string;
  /** Plain trailing text, e.g. "Today". */
  meta?: string;
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
};

export function SectionHeader({ title, meta, action }: Props) {
  return (
    <View style={styles.root}>
      <AppText variant="headline" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {meta !== undefined && !action ? (
        <AppText variant="bodySmall" color="textMuted">
          {meta}
        </AppText>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? `${action.label}, ${title}`}
          hitSlop={spacing.md}
          style={styles.action}
        >
          <AppText variant="label" color="primary">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  title: { flexShrink: 1 },
  action: { minHeight: layout.minTouchTarget - spacing.lg, justifyContent: 'center' },
});
