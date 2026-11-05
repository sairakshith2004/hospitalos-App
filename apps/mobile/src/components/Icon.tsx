import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { colors } from '@/theme/tokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type IconColor = ComponentProps<typeof Ionicons>['color'];

/**
 * App icon vocabulary. Screens use these semantic names, never raw Ionicons names, so the
 * icon set can be swapped in one place.
 */
const GLYPHS = {
  home: 'home-outline',
  queue: 'list-outline',
  search: 'search-outline',
  inbox: 'mail-outline',
  notifications: 'notifications-outline',
  profile: 'person-circle-outline',
  settings: 'settings-outline',
  close: 'close',
  plus: 'add',
  'chevron-right': 'chevron-forward',
  'chevron-left': 'chevron-back',
  check: 'checkmark',
  alert: 'alert-circle-outline',
  info: 'information-circle-outline',
  eye: 'eye-outline',
  'eye-off': 'eye-off-outline',
  lock: 'lock-closed-outline',
  'sign-out': 'log-out-outline',
  swap: 'swap-horizontal-outline',
  modules: 'grid-outline',
  calendar: 'calendar-outline',
  people: 'people-outline',
  clipboard: 'clipboard-outline',
  pulse: 'pulse-outline',
  medkit: 'medkit-outline',
  flask: 'flask-outline',
  cash: 'cash-outline',
  briefcase: 'briefcase-outline',
  cube: 'cube-outline',
  megaphone: 'megaphone-outline',
  shield: 'shield-checkmark-outline',
  business: 'business-outline',
  code: 'code-slash-outline',
  offline: 'cloud-offline-outline',
} as const satisfies Record<string, IoniconName>;

export type IconName = keyof typeof GLYPHS;

type Props = {
  name: IconName;
  size?: number;
  color?: IconColor;
};

/** Decorative icon. The control that contains it must carry the accessible label. */
export function Icon({ name, size = 20, color = colors.text }: Props) {
  return (
    <Ionicons
      name={GLYPHS[name]}
      size={size}
      color={color}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  );
}
