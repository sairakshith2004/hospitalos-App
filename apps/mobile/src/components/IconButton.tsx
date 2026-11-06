import { StyleSheet, View } from 'react-native';

import { borders, colors, iconSize, layout, radius } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  icon: IconName;
  /** Required: icon-only controls have no visible text. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'plain' | 'filled';
  size?: 'md' | 'sm';
  disabled?: boolean;
  /** A small accent dot (e.g. something new). Describe it in the label too. */
  badge?: boolean;
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
  badge = false,
  testID,
}: Props) {
  const visual = size === 'md' ? layout.minTouchTarget - 4 : 36;
  const slop = (layout.minTouchTarget - visual) / 2;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={slop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        { width: visual, height: visual },
        variant === 'filled' && styles.filled,
        disabled && styles.disabled,
      ]}
    >
      <Icon
        name={icon}
        size={size === 'md' ? iconSize.md : iconSize.sm}
        color={disabled ? colors.textDisabled : colors.text}
      />
      {badge ? <View style={styles.badge} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  filled: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
  },
  disabled: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: borders.thin,
    borderColor: colors.surfaceRaised,
  },
});
