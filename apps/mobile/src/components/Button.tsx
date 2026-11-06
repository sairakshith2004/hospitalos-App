import { Children, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { borders, colors, elevation, layout, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  /** lg: 56 dp, for the single main action at the bottom of a form. */
  size?: 'md' | 'lg';
  /** Extra context for screen readers, e.g. "Opens the patient list". */
  accessibilityHint?: string;
  testID?: string;
};

function BaseButton({
  variant,
  label,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  size = 'md',
  accessibilityHint,
  testID,
}: ButtonProps & { variant: Variant }) {
  const inactive = disabled || loading;
  const filled = variant === 'primary' || variant === 'danger';
  const fg = inactive
    ? colors.textDisabled
    : filled
      ? colors.textOnAccent
      : variant === 'ghost'
        ? colors.primary
        : colors.text;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        size === 'lg' && styles.large,
        styles[variant],
        variant === 'primary' && !inactive && elevation.glow,
        fullWidth && styles.fullWidth,
        inactive && (filled ? styles.filledDisabled : styles.outlineDisabled),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} accessibilityElementsHidden />
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText variant="bodyStrong" style={{ color: fg }} numberOfLines={1}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

/** Main call to action. One per view where possible. */
export function PrimaryButton(props: ButtonProps) {
  return <BaseButton {...props} variant="primary" />;
}

/** Secondary or alternative action. */
export function SecondaryButton(props: ButtonProps) {
  return <BaseButton {...props} variant="secondary" />;
}

/** Destructive action. Pair with a confirmation step. */
export function DangerButton(props: ButtonProps) {
  return <BaseButton {...props} variant="danger" />;
}

/** Low-emphasis text action (cyan label, no surface). */
export function GhostButton(props: ButtonProps) {
  return <BaseButton {...props} variant="ghost" />;
}

/**
 * A row of actions that share the width equally and wrap to full width on narrow screens,
 * instead of content-sized buttons with ragged edges. Pass buttons with `fullWidth`.
 */
export function ActionRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.row, style]}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={styles.rowItem}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  large: { minHeight: layout.fabSize, borderRadius: radius.lg },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  secondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
  },
  ghost: { backgroundColor: 'transparent', paddingHorizontal: spacing.md, alignSelf: 'center' },
  filledDisabled: { backgroundColor: colors.surfaceRaised, opacity: 0.7 },
  outlineDisabled: { borderColor: colors.border, opacity: 0.7 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rowItem: { flexGrow: 1, flexBasis: layout.tileMinWidth },
});
