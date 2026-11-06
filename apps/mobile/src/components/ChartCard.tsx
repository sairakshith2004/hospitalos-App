import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { chartColors, layout, motion, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';
import { GlassCard } from './GlassCard';

type ChartCardProps = {
  title: string;
  /** Source and period, e.g. "Today · from the hospital server". */
  caption: string;
  /** Shown as a warning-coloured label when the figures are development demo data. */
  demo?: boolean;
  children: ReactNode;
  enterIndex?: number;
};

/** Frame for a chart: title, honest caption (source and period), the chart. */
export function ChartCard({ title, caption, demo = false, children, enterIndex }: ChartCardProps) {
  return (
    <GlassCard padding="lg" elevation="low" {...(enterIndex === undefined ? {} : { enterIndex })}>
      <View style={styles.head}>
        <AppText variant="subhead" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {demo ? (
          <AppText variant="overline" color="warning">
            DEMO DATA
          </AppText>
        ) : null}
      </View>
      {children}
      <AppText variant="caption" color="textMuted">
        {caption}
      </AppText>
    </GlassCard>
  );
}

export type BarDatum = { key: string; label: string; value: number; display: string };

const [x1, y1, x2, y2] = motion.easing.standard;

function Bar({ share, color }: { share: number; color: string }) {
  const reduced = useReducedMotion();
  const width = useSharedValue(reduced ? share : 0);
  useEffect(() => {
    width.set(
      reduced
        ? share
        : withTiming(share, {
            duration: motion.duration.slow * 2,
            easing: Easing.bezier(x1, y1, x2, y2),
          }),
    );
  }, [reduced, share, width]);
  // Width only: the bar grows inside a fixed track, so the layout never shifts.
  const style = useAnimatedStyle(() => ({ width: `${width.get() * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
    </View>
  );
}

/**
 * Horizontal bars for a handful of same-unit figures from one moment (no time axis). Each bar is
 * labelled with its value; the longest bar is the largest value, zero shows an empty track.
 */
export function BarList({ data }: { data: readonly BarDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.bars}>
      {data.map((d, index) => (
        <View
          key={d.key}
          style={styles.barRow}
          accessible
          accessibilityLabel={`${d.label}: ${d.display}`}
        >
          <View style={styles.barLabels}>
            <AppText
              variant="bodySmall"
              color="textSecondary"
              style={styles.barLabel}
              numberOfLines={1}
            >
              {d.label}
            </AppText>
            <AppText variant="figure">{d.display}</AppText>
          </View>
          <Bar
            share={d.value / max}
            color={chartColors[index % chartColors.length] ?? chartColors[0]}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * One bar split into parts of a whole (e.g. today's appointments by state), with a legend.
 * Parts must add up to the whole they describe; zero parts are listed but take no width.
 */
export function StackedBar({ parts }: { parts: readonly BarDatum[] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  return (
    <View style={styles.bars}>
      <View
        style={styles.stack}
        accessible
        accessibilityLabel={parts.map((p) => `${p.label} ${p.display}`).join(', ')}
      >
        {total === 0
          ? null
          : parts.map((p, index) =>
              p.value > 0 ? (
                <View
                  key={p.key}
                  style={{
                    flex: p.value,
                    backgroundColor: chartColors[index % chartColors.length],
                  }}
                />
              ) : null,
            )}
      </View>
      <View style={styles.legend}>
        {parts.map((p, index) => (
          <View key={p.key} style={styles.legendItem}>
            <View
              style={[styles.swatch, { backgroundColor: chartColors[index % chartColors.length] }]}
            />
            <AppText variant="caption" color="textSecondary">
              {p.label}
            </AppText>
            <AppText variant="caption" style={styles.legendValue}>
              {p.display}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flexShrink: 1 },
  bars: { gap: spacing.md },
  barRow: { gap: spacing.xs + spacing.xxs },
  barLabels: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  barLabel: { flex: 1 },
  track: {
    height: layout.chartBarHeight,
    borderRadius: radius.pill,
    backgroundColor: tints.neutral,
    overflow: 'hidden',
  },
  fill: { height: layout.chartBarHeight, borderRadius: radius.pill },
  stack: {
    flexDirection: 'row',
    height: layout.chartBarHeight + spacing.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
    gap: spacing.xxs,
    backgroundColor: tints.neutral,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: spacing.sm, height: spacing.sm, borderRadius: radius.pill },
  legendValue: { fontWeight: '700', fontVariant: ['tabular-nums'] },
});
