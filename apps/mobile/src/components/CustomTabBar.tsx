import type { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import {
  borders,
  colors,
  elevation,
  iconSize,
  layout,
  motion,
  radius,
  spacing,
  tints,
} from '@/theme/tokens';

import { AppText } from './AppText';

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// React Navigation's own convention: iOS exposes tab buttons as buttons, Android as tabs.
const TAB_ROLE = Platform.OS === 'ios' ? 'button' : 'tab';

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * Floating five-destination navigation. An elevated navy surface with a fine border; the active
 * destination gets a cyan pill that springs between tabs (instant with reduced motion). Labels
 * are short single words so nothing truncates at 360 dp. Hidden while the keyboard is open.
 */
export function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const keyboard = useKeyboardVisible();
  const [width, setWidth] = useState(0);
  const count = state.routes.length;
  const itemWidth = count > 0 ? width / count : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = state.index * itemWidth;
    x.set(reduced || itemWidth === 0 ? target : withSpring(target, motion.spring));
  }, [itemWidth, reduced, state.index, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  if (keyboard && Platform.OS === 'android') return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs }]}
    >
      <View
        style={[styles.bar, elevation.high]}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - spacing.sm * 2)}
      >
        {itemWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, { width: itemWidth }, indicator]}
          >
            <View style={styles.pill} />
          </Animated.View>
        ) : null}
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (descriptor === undefined) return null;
          const { options } = descriptor;
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const color = focused ? colors.primary : colors.textMuted;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole={TAB_ROLE}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              accessibilityState={{ selected: focused }}
              testID={options.tabBarButtonTestID}
              style={styles.item}
            >
              {options.tabBarIcon?.({ focused, color, size: iconSize.md + 2 })}
              <AppText
                variant="caption"
                numberOfLines={1}
                style={[styles.label, { color }, focused && styles.labelFocused]}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Same component under the design-system name. */
export const BottomNavigation = CustomTabBar;

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.tabBarInset,
  },
  bar: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    minHeight: layout.tabBarHeight,
    padding: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.tabBar,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderTopColor: colors.borderHighlight,
  },
  indicator: {
    position: 'absolute',
    top: spacing.sm,
    bottom: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  pill: { flex: 1, borderRadius: radius.lg, backgroundColor: tints.primary },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    minHeight: layout.minTouchTarget,
  },
  label: { fontWeight: '600' },
  labelFocused: { fontWeight: '700' },
});
