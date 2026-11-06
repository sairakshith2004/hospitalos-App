import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { iconSize, layout, radius, spacing, tints, toneColors, type Tone } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';

type Props = {
  label: string;
  value: string;
  caption?: string;
  tone?: Tone;
  icon?: IconName;
  /**
   * Share of a related total (0–1) drawn as a thin bar, e.g. arrived of today's appointments.
   * Only pass a share computed from real figures.
   */
  share?: number;
  enterIndex?: number;
  style?: StyleProp<ViewStyle>;
};

/** Single KPI: icon well, large tabular value, label. Read as one unit by screen readers. */
export function MetricCard({
  label,
  value,
  caption,
  tone = 'primary',
  icon,
  share,
  enterIndex,
  style,
}: Props) {
  const { fg, bg } = toneColors[tone];
  return (
    <GlassCard
      style={[styles.card, style]}
      padding="md"
      elevation="low"
      {...(enterIndex === undefined ? {} : { enterIndex })}
    >
      <View
        accessible
        accessibilityLabel={[label, value, caption].filter(Boolean).join(', ')}
        style={styles.body}
      >
        {icon ? (
          <View style={[styles.well, { backgroundColor: bg }]}>
            <Icon name={icon} size={iconSize.sm} color={fg} />
          </View>
        ) : (
          <View style={[styles.mark, { backgroundColor: fg }]} />
        )}
        <AppText variant="metric" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
          {label}
        </AppText>
        {share !== undefined ? (
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: fg,
                  width: `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`,
                },
              ]}
            />
          </View>
        ) : null}
        {caption !== undefined ? (
          <AppText variant="caption" color="textMuted">
            {caption}
          </AppText>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: layout.tileMinWidth },
  body: { gap: spacing.xs },
  well: {
    width: layout.iconWell - spacing.xs,
    height: layout.iconWell - spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  mark: { width: 18, height: 3, borderRadius: radius.pill, marginBottom: spacing.md },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: tints.neutral,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: { height: 4, borderRadius: radius.pill },
});
