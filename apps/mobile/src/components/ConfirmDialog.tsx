import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { borders, colors, elevation, layout, motion, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { DangerButton, PrimaryButton, SecondaryButton } from './Button';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Centred confirmation dialog, rendered by a transparent-modal route. Tapping the scrim,
 * pressing Cancel or the Android back button all dismiss it.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const ConfirmButton = destructive ? DangerButton : PrimaryButton;

  return (
    <Animated.View
      {...(reduced ? {} : { entering: FadeIn.duration(motion.duration.base) })}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Dismiss dialog"
      />
      <Animated.View
        {...(reduced ? {} : { entering: ZoomIn.duration(motion.duration.base) })}
        style={[styles.card, elevation.high]}
        accessibilityViewIsModal
        accessibilityRole="alert"
      >
        <AppText variant="headline" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {message}
        </AppText>
        <View style={styles.actions}>
          <SecondaryButton label={cancelLabel} onPress={onCancel} />
          <ConfirmButton label={confirmLabel} onPress={onConfirm} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: layout.dialogMaxWidth,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

/** Same component under the design-system name. */
export const ConfirmationDialog = ConfirmDialog;
