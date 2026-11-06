import { StyleSheet, View } from 'react-native';

import { borders, iconSize, layout, radius, spacing, toneColors, type Tone } from '@/theme/tokens';

import { AppText } from './AppText';
import { SecondaryButton } from './Button';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  message?: string;
  icon?: IconName;
  tone?: Tone;
  action?: { label: string; onPress: () => void };
};

/** What is missing, why, and (when there is one) the next step. */
export function EmptyState({ title, message, icon = 'info', tone = 'primary', action }: Props) {
  const { fg, bg } = toneColors[tone];
  return (
    <View style={styles.root}>
      <View style={[styles.halo, { borderColor: bg }]}>
        <View style={[styles.well, { backgroundColor: bg }]}>
          <Icon name={icon} size={iconSize.lg} color={fg} />
        </View>
      </View>
      <AppText variant="headline" style={styles.center} accessibilityRole="header">
        {title}
      </AppText>
      {message !== undefined ? (
        <AppText variant="bodySmall" color="textMuted" style={[styles.center, styles.message]}>
          {message}
        </AppText>
      ) : null}
      {action ? <SecondaryButton label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export const stateStyles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  halo: {
    padding: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: borders.focus,
    marginBottom: spacing.xs,
  },
  well: {
    width: layout.stateWell,
    height: layout.stateWell,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  message: { maxWidth: layout.proseMaxWidth },
});
const styles = stateStyles;
