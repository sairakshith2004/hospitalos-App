import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';

import { useReduceTransparency } from '@/hooks/useAccessibilitySetting';
import { borders, colors, elevation, glass, radius } from '@/theme/tokens';

import { SurfaceCard, cardPadding, type SurfaceCardProps } from './SurfaceCard';

type Props = SurfaceCardProps & { intensity?: number };

/**
 * Frosted card for hero and summary panels. Real blur on iOS only. Android
 * (where expo-blur needs a heavier BlurTargetView setup) and iOS "Reduce
 * Transparency" get the opaque SurfaceCard fallback, which keeps text contrast
 * predictable. Use sparingly: one or two glass panels per screen.
 */
export function GlassCard({
  children,
  style,
  padding = 'md',
  elevation: level = 'medium',
  intensity = glass.intensity,
  testID,
}: Props) {
  const reduceTransparency = useReduceTransparency();

  if (Platform.OS !== 'ios' || reduceTransparency) {
    return (
      <SurfaceCard
        style={style}
        padding={padding}
        elevation={level}
        testID={testID ?? 'glass-fallback'}
      >
        {children}
      </SurfaceCard>
    );
  }

  return (
    <View testID={testID} style={[styles.shell, elevation[level], style]}>
      <BlurView intensity={intensity} tint={glass.tint} style={StyleSheet.absoluteFill} />
      <View style={{ padding: cardPadding[padding] }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
