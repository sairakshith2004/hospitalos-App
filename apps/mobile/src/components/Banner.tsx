import { StyleSheet, View } from 'react-native';

import { borders, radius, spacing, toneColors, type Tone } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Props = {
  title: string;
  message?: string;
  tone?: Tone;
  icon?: IconName;
};

/** Inline notice, e.g. "Development only" or "Showing demo data". */
export function Banner({ title, message, tone = 'warning', icon = 'info' }: Props) {
  const { fg, bg } = toneColors[tone];
  return (
    <View
      style={[styles.root, { backgroundColor: bg, borderColor: fg }]}
      accessible
      accessibilityRole="summary"
    >
      <Icon name={icon} size={20} color={fg} />
      <View style={styles.text}>
        <AppText variant="label" style={{ color: fg }}>
          {title}
        </AppText>
        {message !== undefined ? (
          <AppText variant="bodySmall" color="textSecondary">
            {message}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: borders.hairline,
  },
  text: { flex: 1, gap: spacing.xxs },
});
