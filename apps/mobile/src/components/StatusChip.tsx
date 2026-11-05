import { StyleSheet, View } from 'react-native';

import { radius, spacing, toneColors, type Tone } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  label: string;
  tone?: Tone;
  /** Show a leading dot. The label always carries the meaning; colour is never the only signal. */
  dot?: boolean;
};

export function StatusChip({ label, tone = 'neutral', dot = true }: Props) {
  const { fg, bg } = toneColors[tone];
  return (
    <View
      style={[styles.chip, { backgroundColor: bg }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <AppText variant="caption" style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

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
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  label: { fontWeight: '600' },
});
