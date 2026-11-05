import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { borders, colors, elevation, radius, spacing } from '@/theme/tokens';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardElevation = keyof typeof elevation;

export type SurfaceCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  padding?: CardPadding;
  elevation?: CardElevation;
  testID?: string;
}>;

export const cardPadding: Record<CardPadding, number> = {
  none: 0,
  sm: spacing.md,
  md: spacing.lg,
  lg: spacing.xl,
};

/** Opaque card. Use for dense content, forms and lists, and as the glass fallback. */
export function SurfaceCard({
  children,
  style,
  padding = 'md',
  elevation: level = 'low',
  testID,
}: SurfaceCardProps) {
  return (
    <View
      testID={testID}
      style={[styles.card, elevation[level], { padding: cardPadding[padding] }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
});
