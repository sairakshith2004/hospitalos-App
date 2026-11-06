import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Scale while pressed (default motion.pressedScale). */
  scaleTo?: number;
};

/**
 * Pressable with spring scale and opacity feedback, both on the UI thread (Reanimated).
 * Reduced motion keeps the opacity feedback and drops the scale.
 */
export function PressableScale({
  style,
  children,
  scaleTo = motion.pressedScale,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        if (!reduced) scale.set(withSpring(scaleTo, motion.spring));
        opacity.set(withTiming(motion.pressedOpacity, { duration: motion.duration.fast }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, motion.spring));
        opacity.set(withTiming(1, { duration: motion.duration.base }));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
