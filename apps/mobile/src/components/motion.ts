import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { motion } from '@/theme/tokens';

const [x1, y1, x2, y2] = motion.easing.decelerate;

/**
 * Entrance for cards and rows: a short fade-and-rise on mount, staggered by position and capped so
 * long lists never wait. Opacity and transform only (no layout animation), so siblings never move.
 * `index` undefined = no entrance. Reduced motion shows the final state at once.
 */
export function useEntrance(index: number | undefined) {
  const reduced = useReducedMotion();
  const enabled = index !== undefined && !reduced;
  const progress = useSharedValue(enabled ? 0 : 1);
  useEffect(() => {
    if (!enabled) {
      progress.set(1);
      return;
    }
    progress.set(
      withDelay(
        Math.min((index ?? 0) * motion.stagger, motion.staggerMax),
        withTiming(1, { duration: motion.duration.slow, easing: Easing.bezier(x1, y1, x2, y2) }),
      ),
    );
  }, [enabled, index, progress]);
  return useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * motion.enterOffset }],
  }));
}
