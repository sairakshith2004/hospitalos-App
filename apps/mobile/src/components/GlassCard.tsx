import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useReduceTransparency } from '@/hooks/useAccessibilitySetting';
import { borders, colors, elevation, glass, gradients, radius, spacing } from '@/theme/tokens';

import { useEntrance } from './motion';
import { SurfaceCard, cardPadding, type SurfaceCardProps } from './SurfaceCard';

type Props = SurfaceCardProps & {
  intensity?: number;
  /** hero: cyan-to-violet wash for the one summary panel at the top of a screen. */
  tone?: 'default' | 'hero';
};

/**
 * Frosted card for hero and summary panels. Real blur on iOS only. Android (where expo-blur
 * needs a heavier BlurTargetView setup), web and iOS "Reduce Transparency" get an opaque surface
 * with the same edge highlight and, for heroes, a low-opacity accent gradient: no blur cost on
 * mid-range phones. Use sparingly: one or two glass panels per screen.
 */
export function GlassCard({
  children,
  style,
  padding = 'md',
  elevation: level = 'medium',
  intensity = glass.intensity,
  tone = 'default',
  enterIndex,
  testID,
}: Props) {
  const reduceTransparency = useReduceTransparency();
  const enter = useEntrance(enterIndex);
  const wash =
    tone === 'hero' ? (
      <LinearGradient
        colors={gradients.hero.colors}
        locations={gradients.hero.locations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    ) : null;

  if (Platform.OS !== 'ios' || reduceTransparency) {
    return (
      <SurfaceCard
        style={style}
        padding="none"
        elevation={level}
        {...(enterIndex === undefined ? {} : { enterIndex })}
        testID={testID ?? 'glass-fallback'}
      >
        {wash}
        <View style={[padding !== 'none' && styles.body, { padding: cardPadding[padding] }]}>
          {children}
        </View>
      </SurfaceCard>
    );
  }

  return (
    <Animated.View testID={testID} style={[styles.shell, elevation[level], style, enter]}>
      <BlurView intensity={intensity} tint={glass.tint} style={StyleSheet.absoluteFill} />
      {wash}
      <View style={[padding !== 'none' && styles.body, { padding: cardPadding[padding] }]}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
    backgroundColor: colors.surface,
  },
  body: { gap: spacing.md },
});
