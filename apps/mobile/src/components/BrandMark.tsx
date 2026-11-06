import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { colors, elevation, gradients, iconSize, layout, radius } from '@/theme/tokens';

import { Icon } from './Icon';

const SIZES = { md: layout.iconWell + 4, lg: 72 } as const;

/** Product mark drawn from tokens (cyan-to-violet tile, pulse glyph). No image of a real organisation. */
export function BrandMark({ size = 'md' }: { size?: keyof typeof SIZES }) {
  const d = SIZES[size];
  return (
    <LinearGradient
      colors={gradients.accent.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.mark,
        size === 'lg' && elevation.glow,
        { width: d, height: d, borderRadius: size === 'lg' ? radius.xl : radius.sm },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="HospitalOS"
    >
      <Icon
        name="pulse"
        size={size === 'lg' ? iconSize.xl + 8 : iconSize.md}
        color={colors.textOnAccent}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
});
