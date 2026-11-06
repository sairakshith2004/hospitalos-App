import { Pressable, StyleSheet, View } from 'react-native';

import { layout, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  title: string;
  /** Plain trailing text, e.g. "Today". */
  meta?: string;
  /** Small count badge after the title, e.g. items waiting. */
  count?: number;
  action?: { label: string; onPress: () => void; accessibilityLabel?: string };
};

export function SectionHeader({ title, meta, count, action }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.titleRow}>
        <AppText variant="headline" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {count !== undefined ? (
          <View
            style={[styles.count, count > 0 && styles.countActive]}
            accessible
            accessibilityLabel={`${count} ${count === 1 ? 'item' : 'items'}`}
          >
            <AppText
              variant="caption"
              color={count > 0 ? 'primary' : 'textMuted'}
              style={styles.countText}
            >
              {count}
            </AppText>
          </View>
        ) : null}
      </View>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  title: { flexShrink: 1 },
  count: {
    minWidth: spacing.xl,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: tints.neutral,
  },
  countActive: { backgroundColor: tints.primary },
  countText: { fontWeight: '700' },
  action: { minHeight: layout.minTouchTarget - spacing.lg, justifyContent: 'center' },
});
