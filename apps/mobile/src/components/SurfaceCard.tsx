import type { PropsWithChildren } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { borders, colors, elevation, radius, spacing } from '@/theme/tokens';

import { useEntrance } from './motion';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardElevation = keyof typeof elevation;
export type CardVariant = 'default' | 'raised' | 'outline';

export type SurfaceCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  padding?: CardPadding;
  elevation?: CardElevation;
  /** default: card surface; raised: one step lighter; outline: transparent with a border. */
  variant?: CardVariant;
  /** Position in a list, for a staggered entrance. Omit for no entrance animation. */
  enterIndex?: number;
  testID?: string;
}>;

export const cardPadding: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl,
};

/** Vertical rhythm between children of a padded card. Unpadded cards hold divided lists. */
const cardGap: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.md,
};

/** Opaque card. Use for dense content, forms and lists, and as the glass fallback. */
export function SurfaceCard({
  children,
  style,
  padding = 'md',
  elevation: level = 'low',
  variant = 'default',
  enterIndex,
  testID,
}: SurfaceCardProps) {
  const enter = useEntrance(enterIndex);
  const body = [
    styles.card,
    styles[variant],
    elevation[level],
    { padding: cardPadding[padding], gap: cardGap[padding] },
    style,
  ];
  return (
    <Animated.View testID={testID} style={[body, enter]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
    overflow: 'hidden',
  },
  default: { backgroundColor: colors.surfaceStrong },
  raised: { backgroundColor: colors.surfaceRaised },
  outline: { backgroundColor: 'transparent', borderTopColor: colors.border },
});
