import { View } from 'react-native';

import { iconSize, toneColors } from '@/theme/tokens';

import { AppText } from './AppText';
import { SecondaryButton } from './Button';
import { stateStyles as styles } from './EmptyState';
import { Icon, type IconName } from './Icon';

type Variant = 'error' | 'offline' | 'forbidden';

type Props = {
  title?: string;
  message?: string;
  /** Development-only detail. Never pass server messages that could contain record data. */
  detail?: string;
  onRetry?: () => void;
  /** offline: the server could not be reached; forbidden: the role may not see this. */
  variant?: Variant;
};

const VARIANTS: Record<
  Variant,
  { icon: IconName; tone: 'danger' | 'warning' | 'neutral'; title: string; message: string }
> = {
  error: {
    icon: 'alert',
    tone: 'danger',
    title: 'Something went wrong',
    message: 'This could not be loaded. Check your connection and try again.',
  },
  offline: {
    icon: 'offline',
    tone: 'warning',
    title: 'You are offline',
    message: 'Cannot reach the HospitalOS server. Nothing was changed. Try again when connected.',
  },
  forbidden: {
    icon: 'lock',
    tone: 'neutral',
    title: 'Not available for your role',
    message: 'Your account does not have permission to see this.',
  },
};

export function ErrorState({ title, message, detail, onRetry, variant = 'error' }: Props) {
  const v = VARIANTS[variant];
  const { fg, bg } = toneColors[v.tone];
  return (
    <View style={styles.root} accessibilityRole="alert">
      <View style={[styles.halo, { borderColor: bg }]}>
        <View style={[styles.well, { backgroundColor: bg }]}>
          <Icon name={v.icon} size={iconSize.lg} color={fg} />
        </View>
      </View>
      <AppText variant="headline" style={styles.center}>
        {title ?? v.title}
      </AppText>
      <AppText variant="bodySmall" color="textMuted" style={[styles.center, styles.message]}>
        {message ?? v.message}
      </AppText>
      {detail !== undefined ? (
        <AppText variant="caption" color="danger" style={styles.center} testID="error-detail">
          {detail}
        </AppText>
      ) : null}
      {onRetry && variant !== 'forbidden' ? (
        <SecondaryButton label="Try again" onPress={onRetry} />
      ) : null}
    </View>
  );
}
