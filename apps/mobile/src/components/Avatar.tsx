import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { borders, colors, gradients, radius } from '@/theme/tokens';

import { AppText } from './AppText';

const SIZES = { sm: 32, md: 44, lg: 64, xl: 80 } as const;

type Props = {
  /** Full name; initials are derived from it and it is used as the accessible label. */
  name: string;
  size?: keyof typeof SIZES;
  /** Cyan-to-violet ring: the signed-in person, never patients. */
  ring?: boolean;
};

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** Initials avatar. No photos, to avoid handling personal images. */
export function Avatar({ name, size = 'md', ring = false }: Props) {
  const dimension = SIZES[size];
  const face = (
    <View
      style={[styles.root, { width: dimension, height: dimension }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
    >
      <AppText
        variant={size === 'lg' || size === 'xl' ? 'headline' : 'label'}
        allowFontScaling={false}
        accessibilityElementsHidden
      >
        {initialsFrom(name)}
      </AppText>
    </View>
  );
  if (!ring) return face;
  return (
    <LinearGradient
      colors={gradients.accent.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { borderRadius: dimension }]}
    >
      {face}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.pill,
    backgroundColor: colors.avatar,
    borderWidth: borders.thin,
    borderColor: colors.avatarBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { padding: borders.focus },
});
