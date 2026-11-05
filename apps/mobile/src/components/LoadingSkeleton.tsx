import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { colors, motion, radius, spacing } from '@/theme/tokens';

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
};

/** List-shaped loading placeholder. */
export function LoadingSkeleton({ rows = 3, accessibilityLabel = 'Loading' }: Props) {
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
  list: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  lines: { flex: 1, gap: spacing.sm },
});
