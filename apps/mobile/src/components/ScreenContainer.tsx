import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { colors, gradients, layout, spacing } from '@/theme/tokens';

type Props = PropsWithChildren<{
  /** Scrollable by default; pass false for screens that manage their own lists. */
  scroll?: boolean;
  /** Override the readable column width, e.g. for the showcase width preview. */
  maxWidth?: number;
  /** Bottom safe-area padding. Off inside tab screens, where the tab bar owns that inset. */
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
    paddingBottom: (bottomInset ? insets.bottom : 0) + spacing.xxl,
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
