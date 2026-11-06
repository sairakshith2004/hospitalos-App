import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors, gradients, layout, spacing, tints } from '@/theme/tokens';

type Props = PropsWithChildren<{
  /** Scrollable by default; pass false for screens that manage their own lists. */
  scroll?: boolean;
  /** Override the readable column width, e.g. for the showcase width preview. */
  maxWidth?: number;
  /**
   * Bottom safe-area padding. False inside tab screens: the content then leaves room for the
   * floating tab bar instead.
   */
  bottomInset?: boolean;
  testID?: string;
}>;

/**
 * Screen shell: background gradient, safe-area padding (edge-to-edge on Android),
 * responsive side padding and a centred max-width column for tablets.
 */
export function ScreenContainer({
  children,
  scroll = true,
  maxWidth = layout.maxContentWidth,
  bottomInset = true,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  const { screenPadding } = useResponsiveLayout();

  const padding = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: insets.bottom + (bottomInset ? spacing.xxl : layout.tabBarClearance),
    paddingLeft: insets.left + screenPadding,
    paddingRight: insets.right + screenPadding,
  };

  const column = <View style={[styles.column, { maxWidth }]}>{children}</View>;

  return (
    <View style={styles.root} testID={testID}>
      <LinearGradient
        colors={gradients.screen.colors}
        locations={gradients.screen.locations}
        style={StyleSheet.absoluteFill}
      />
      {/* A faint violet ambient light from the top right, for depth. Static: no battery cost. */}
      <LinearGradient
        colors={[tints.secondary, 'transparent']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.35, y: 0.35 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Keeps focused inputs above the keyboard on both platforms (edge-to-edge Android). */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={padding}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            {column}
          </ScrollView>
        ) : (
          <View style={[styles.fill, padding]}>{column}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  column: { width: '100%', alignSelf: 'center', gap: spacing.lg + spacing.xxs },
});

/** Same component under the design-system name. */
export const AppScreen = ScreenContainer;
