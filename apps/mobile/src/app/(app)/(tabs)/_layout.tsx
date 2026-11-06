import { Tabs } from 'expo-router';

import { CustomTabBar } from '@/components/CustomTabBar';
import { Icon, type IconName } from '@/components/Icon';
import { colors, typography } from '@/theme/tokens';

const TABS: readonly { name: string; title: string; label?: string; icon: IconName }[] = [
  { name: 'home', title: 'Home', icon: 'home' },
  // Visible label shortened so it never truncates at 360 dp; screen readers hear the full name.
  { name: 'queue', title: 'Work Queue', label: 'Queue', icon: 'queue' },
  { name: 'search', title: 'Search', icon: 'search' },
  { name: 'inbox', title: 'Inbox', icon: 'inbox' },
  { name: 'profile', title: 'Profile', icon: 'profile' },
];

/**
 * Five stable destinations for every role. Hospital modules live on Home, not here.
 * Android back from any tab returns to Home first, then leaves the app (Material pattern).
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      backBehavior="firstRoute"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: typography.caption.fontSize, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.backgroundElevated, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarLabel: tab.label ?? tab.title,
            tabBarAccessibilityLabel: tab.title,
            tabBarIcon: ({ color, size }) => <Icon name={tab.icon} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
