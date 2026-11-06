import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';

type Props = {
  title: string;
  /** Small uppercase context above the title (date, role or module). */
  eyebrow?: string;
  subtitle?: string;
  /** Right-hand actions: icon buttons or an avatar. */
  trailing?: ReactNode;
};

/**
 * Top header for tab screens. The screen's ambient gradient sits behind it; the header itself
 * stays flat so titles keep full contrast.
 */
export function GradientHeader({ title, eyebrow, subtitle, trailing }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.text}>
        {eyebrow !== undefined ? (
          <AppText variant="overline" color="primary" numberOfLines={1}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="display" accessibilityRole="header" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle !== undefined ? (
          <AppText variant="bodySmall" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing !== undefined ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
