import { StyleSheet, View } from 'react-native';

import { colors, layout, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';
import { SecondaryButton } from './Button';
import { Icon } from './Icon';

type Props = {
  title?: string;
  message?: string;
  /** Development-only detail. Never pass server messages that could contain record data. */
  detail?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Something went wrong',
  message = 'This could not be loaded. Check your connection and try again.',
  detail,
  onRetry,
}: Props) {
  return (
    <View style={styles.root} accessibilityRole="alert">
      <View style={styles.well}>
        <Icon name="alert" size={24} color={colors.danger} />
      </View>
      <AppText variant="headline" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="bodySmall" color="textMuted" style={styles.center}>
        {message}
      </AppText>
      {detail !== undefined ? (
        <AppText variant="caption" color="danger" style={styles.center} testID="error-detail">
          {detail}
        </AppText>
      ) : null}
      {onRetry ? <SecondaryButton label="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  well: {
    width: layout.stateWell,
    height: layout.stateWell,
    borderRadius: radius.pill,
    backgroundColor: tints.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  center: { textAlign: 'center' },
});
