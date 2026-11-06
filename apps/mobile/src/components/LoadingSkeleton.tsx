import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { borders, colors, layout, motion, radius, spacing } from '@/theme/tokens';

type BlockProps = {
  width?: DimensionValue;
  height?: number;
  rounded?: keyof typeof radius;
};

/** One placeholder bar. Pulses gently; static when the OS asks for reduced motion. */
export function SkeletonBlock({ width = '100%', height = 14, rounded = 'xs' }: BlockProps) {
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(motion.skeleton.maxOpacity));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(motion.skeleton.maxOpacity);
      return undefined;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: motion.skeleton.minOpacity,
          duration: motion.duration.pulse,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: motion.skeleton.maxOpacity,
          duration: motion.duration.pulse,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: radius[rounded], opacity }]}
    />
  );
}

type Props = {
  /** Number of list-row placeholders. */
  rows?: number;
  /** Announced to screen readers, e.g. "Loading appointments". */
  accessibilityLabel?: string;
  /** list (default): rows in a card; tiles: a 2-up grid shaped like metric cards. */
  variant?: 'list' | 'tiles';
};

/** Loading placeholder shaped like the content it replaces, so nothing jumps when data arrives. */
export function LoadingSkeleton({
  rows = 3,
  accessibilityLabel = 'Loading',
  variant = 'list',
}: Props) {
  if (variant === 'tiles') {
    return (
      <View
        style={styles.tiles}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ busy: true }}
      >
        {Array.from({ length: rows }, (_, index) => (
          <View key={index} style={styles.tile}>
            <SkeletonBlock width={28} height={28} rounded="sm" />
            <SkeletonBlock width="50%" height={22} />
            <SkeletonBlock width="80%" height={10} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View
      style={styles.list}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <SkeletonBlock width={40} height={40} rounded="sm" />
          <View style={styles.lines}>
            <SkeletonBlock width="70%" />
            <SkeletonBlock width="45%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.skeleton },
  list: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: spacing.sm,
    padding: spacing.lg,
    minHeight: layout.tileMinWidth,
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lines: { flex: 1, gap: spacing.sm },
});
