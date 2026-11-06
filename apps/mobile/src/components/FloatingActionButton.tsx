import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, gradients, iconSize, layout, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** Sits above the floating tab bar on tab screens. */
  aboveTabBar?: boolean;
};

/**
 * The one primary creation action of a screen (e.g. Register patient), as an extended FAB.
 * Render it only when the signed-in role holds the permission for the action.
 */
export function FloatingActionButton({ label, icon, onPress, aboveTabBar = true }: Props) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + (aboveTabBar ? layout.tabBarClearance - spacing.sm : spacing.xl);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.root, elevation.glow, { bottom }]}
    >
      <LinearGradient
        colors={gradients.accent.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fill}
      >
        <Icon name={icon} size={iconSize.md} color={colors.textOnAccent} />
        <AppText variant="bodyStrong" color="textOnAccent">
          {label}
        </AppText>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', right: spacing.lg, borderRadius: radius.pill },
  fill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.fabSize,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
});
