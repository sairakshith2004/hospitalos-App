import { StyleSheet, View } from 'react-native';

import { radius, spacing, toneColors, type Tone } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  label: string;
  tone?: Tone;
  /** Show a leading dot. The label always carries the meaning; colour is never the only signal. */
  dot?: boolean;
  size?: 'sm' | 'md';
};

/** Status badge: tinted pill with a label (and optional dot). Read as "Status: …". */
export function StatusChip({ label, tone = 'neutral', dot = true, size = 'sm' }: Props) {
  const { fg, bg } = toneColors[tone];
  return (
    <View
      style={[styles.chip, size === 'md' && styles.md, { backgroundColor: bg }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <AppText
        variant={size === 'md' ? 'label' : 'caption'}
        style={[styles.label, { color: fg }]}
        numberOfLines={1}
      >
        {label}
      </AppText>
    </View>
  );
}

/** Same component under the design-system name. */
export const StatusBadge = StatusChip;

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + spacing.xxs,
    paddingHorizontal: spacing.sm + spacing.xxs,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  md: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + spacing.xxs },
  dot: {
    width: spacing.xs + spacing.xxs,
    height: spacing.xs + spacing.xxs,
    borderRadius: radius.pill,
  },
  label: { fontWeight: '600', letterSpacing: 0.2 },
});
