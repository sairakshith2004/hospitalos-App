import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { borders, colors, layout, motion, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'danger';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
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
  accessibilityHint,
  testID,
}: ButtonProps & { variant: Variant }) {
  const reducedMotion = useReducedMotion();
  const inactive = disabled || loading;
  const filled = variant !== 'secondary';
  const fg = inactive ? colors.textDisabled : filled ? colors.textOnAccent : colors.primary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        inactive && (filled ? styles.filledDisabled : styles.outlineDisabled),
        pressed && {
          opacity: motion.pressedOpacity,
          transform: reducedMotion ? [] : [{ scale: motion.pressedScale }],
        },
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
    </Pressable>
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

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: borders.thin,
    borderColor: colors.borderStrong,
  },
  filledDisabled: { backgroundColor: colors.surfaceRaised },
  outlineDisabled: { borderColor: colors.border },
});
