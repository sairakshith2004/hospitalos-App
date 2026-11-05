import { Pressable, StyleSheet } from 'react-native';

import { borders, colors, layout, motion, radius } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

type Props = {
  icon: IconName;
  /** Required: icon-only controls have no visible text. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'plain' | 'filled';
  size?: 'md' | 'sm';
  disabled?: boolean;
  testID?: string;
};

/** Icon-only button. The visual can shrink to 36px but the touch target stays 48px. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'filled',
  size = 'md',
  disabled = false,
  testID,
}: Props) {
  const visual = size === 'md' ? layout.minTouchTarget : 36;
  const slop = (layout.minTouchTarget - visual) / 2;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { width: visual, height: visual },
        variant === 'filled' && styles.filled,
        pressed && { backgroundColor: colors.surfacePressed, opacity: motion.pressedOpacity },
        disabled && styles.disabled,
      ]}
    >
      <Icon
        name={icon}
        size={size === 'md' ? 20 : 16}
        color={disabled ? colors.textDisabled : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  filled: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: borders.thin,
    borderColor: colors.border,
  },
  disabled: { opacity: 0.6 },
});
