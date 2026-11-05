import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, toneColors, type Tone } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';

type Props = {
  label: string;
  value: string;
  caption?: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
};

/** Single KPI. Read as one unit by screen readers. */
export function MetricCard({ label, value, caption, tone = 'primary', style }: Props) {
  return (
    <GlassCard style={style} padding="md" elevation="low">
      <View accessible accessibilityLabel={[label, value, caption].filter(Boolean).join(', ')}>
        <View style={[styles.mark, { backgroundColor: toneColors[tone].fg }]} />
        <AppText variant="metric" numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </AppText>
        <AppText variant="bodySmall" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
        {caption !== undefined ? (
          <AppText variant="caption" color="textMuted" style={styles.caption}>
            {caption}
          </AppText>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  mark: { width: 18, height: 3, borderRadius: radius.pill, marginBottom: spacing.md },
  label: { marginTop: spacing.xs },
  caption: { marginTop: spacing.sm },
});
