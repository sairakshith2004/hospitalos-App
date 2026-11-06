import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { GlassCard } from './GlassCard';

type Props = {
  name: string;
  role: string;
  /** e.g. employee number or department. */
  detail?: string;
  /** Badges under the name (session type, role chips). */
  children?: ReactNode;
};

/** The signed-in person's identity at the top of Profile. */
export function ProfileHeader({ name, role, detail, children }: Props) {
  return (
    <GlassCard tone="hero" padding="lg" enterIndex={0}>
      <View style={styles.row}>
        <Avatar name={name} size="xl" ring />
        <View style={styles.text}>
          <AppText variant="title" numberOfLines={2}>
            {name}
          </AppText>
          <AppText variant="body" color="primary">
            {role}
          </AppText>
          {detail !== undefined ? (
            <AppText variant="bodySmall" color="textMuted">
              {detail}
            </AppText>
          ) : null}
          {children !== undefined ? <View style={styles.badges}>{children}</View> : null}
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  text: { flex: 1, gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
