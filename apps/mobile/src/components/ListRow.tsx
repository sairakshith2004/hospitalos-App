import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { borders, colors, iconSize, layout, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** When set, the row becomes a button and shows a chevron. */
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
};

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityHint,
  testID,
}: Props) {
  const content = (
    <>
      {leading}
      <View style={styles.body}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle !== undefined ? (
          <AppText variant="bodySmall" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Icon name="chevron-right" size={iconSize.sm} color={colors.textMuted} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View testID={testID} style={styles.row} accessible>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/**
 * Children separated by hairline dividers, inside whatever card holds them. Use for every list
 * of rows so rows never run together.
 */
export function Divided({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <>
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={styles.divider} /> : null}
          {child}
        </Fragment>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.minTouchTarget + spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  pressed: { backgroundColor: colors.surfacePressed },
  body: { flex: 1, gap: spacing.xxs },
  divider: {
    height: borders.hairline,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
});
