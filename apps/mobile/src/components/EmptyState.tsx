import { StyleSheet, View } from 'react-native';

import { colors, layout, radius, spacing, tints } from '@/theme/tokens';

import { AppText } from './AppText';
import { SecondaryButton } from './Button';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  message?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ title, message, icon = 'info', action }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.well}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      <AppText variant="headline" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      {message !== undefined ? (
        <AppText variant="bodySmall" color="textMuted" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {action ? <SecondaryButton label={action.label} onPress={action.onPress} /> : null}
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
    backgroundColor: tints.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  center: { textAlign: 'center' },
});
