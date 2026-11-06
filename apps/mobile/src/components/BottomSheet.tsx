import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { borders, colors, elevation, layout, motion, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { IconButton } from './IconButton';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Bottom sheet over a scrim. Closes from the scrim, the close button or Android back
 * (`onRequestClose`). Slides up; reduced motion shows it without movement.
 */
export function BottomSheet({ visible, title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.scrim]}
        {...(reduced
          ? {}
          : {
              entering: FadeIn.duration(motion.duration.base),
              exiting: FadeOut.duration(motion.duration.fast),
            })}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close sheet"
        />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          {...(reduced
            ? {}
            : {
                entering: SlideInDown.springify().damping(motion.spring.damping),
                exiting: SlideOutDown.duration(motion.duration.base),
              })}
          style={[
            styles.sheet,
            elevation.high,
            {
              maxHeight: height * layout.sheetMaxHeight,
              paddingBottom: insets.bottom + spacing.lg,
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            <AppText variant="headline" accessibilityRole="header" style={styles.title}>
              {title}
            </AppText>
            <IconButton icon="close" size="sm" accessibilityLabel="Close" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
  },
  handle: {
    alignSelf: 'center',
    width: spacing.xxl + spacing.sm,
    height: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginTop: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  title: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },
});
