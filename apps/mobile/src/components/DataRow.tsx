import { StyleSheet, View } from 'react-native';

import { borders, colors, spacing } from '@/theme/tokens';

import { AppText, type TextColor } from './AppText';

type Props = {
  label: string;
  value: string;
  /** emphasis: the total line (larger figure, divider above). */
  emphasis?: boolean;
  valueColor?: TextColor;
  /** Struck-through line, e.g. a charge removed from a draft. */
  inactive?: boolean;
};

/**
 * Label on the left, value right-aligned in tabular figures: money columns and key facts line up.
 */
export function DataRow({
  label,
  value,
  emphasis = false,
  valueColor = 'text',
  inactive = false,
}: Props) {
  return (
    <View
      style={[styles.row, emphasis && styles.emphasis]}
      accessible
      accessibilityLabel={`${label}, ${value}${inactive ? ', removed' : ''}`}
    >
      <AppText
        variant={emphasis ? 'subhead' : 'bodySmall'}
        color={emphasis ? 'text' : 'textSecondary'}
        style={[styles.label, inactive && styles.struck]}
      >
        {label}
      </AppText>
      <AppText
        variant={emphasis ? 'figureLarge' : 'figure'}
        color={inactive ? 'textMuted' : valueColor}
        style={inactive && styles.struck}
      >
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  emphasis: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: borders.hairline,
    borderTopColor: colors.borderStrong,
  },
  label: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
});
