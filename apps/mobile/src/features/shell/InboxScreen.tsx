import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  Divided,
  EmptyState,
  GlassCard,
  GradientHeader,
  Icon,
  ScreenContainer,
  StatusChip,
  type IconName,
} from '@/components';
import { colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

const COMING: readonly { icon: IconName; title: string; detail: string }[] = [
  { icon: 'megaphone', title: 'Hospital notices', detail: 'Announcements for your department' },
  { icon: 'people', title: 'Staff messages', detail: 'Direct and group conversations' },
  {
    icon: 'stethoscope',
    title: 'Doctor call requests',
    detail: 'From nurses to the treating doctor',
  },
  { icon: 'calendar', title: 'Meeting invitations', detail: 'Video meetings arrive in Release 8' },
];

/**
 * Inbox: notices, staff messages, doctor call requests and meeting invitations, filtered by the
 * user's permissions. They arrive in Release 7 (video meetings in Release 8). Until then this
 * screen shows only this placeholder: no counts, badges or sample items (docs/MOBILE-PRODUCT-SCOPE.md MD-6).
 */
export function InboxScreen() {
  return (
    <ScreenContainer bottomInset={false}>
      <GradientHeader
        eyebrow="MESSAGES"
        title="Inbox"
        trailing={<StatusChip label="ARRIVES IN RELEASE 7" tone="neutral" dot={false} />}
      />
      <GlassCard tone="hero" padding="none" enterIndex={0}>
        <EmptyState
          icon="inbox"
          title="Your inbox arrives in Release 7"
          message="Notices, staff messages, doctor call requests and meeting invitations will appear here. Nothing is shown until they come from the hospital server."
        />
      </GlassCard>
      <AppText variant="overline" color="textMuted">
        WHAT WILL ARRIVE HERE
      </AppText>
      <GlassCard padding="none" elevation="low" enterIndex={1}>
        <Divided>
          {COMING.map((item) => (
            <View key={item.title} style={styles.row} accessible>
              <View style={styles.well}>
                <Icon name={item.icon} size={iconSize.sm} color={colors.secondary} />
              </View>
              <View style={styles.text}>
                <AppText variant="bodyStrong">{item.title}</AppText>
                <AppText variant="bodySmall" color="textMuted">
                  {item.detail}
                </AppText>
              </View>
            </View>
          ))}
        </Divided>
      </GlassCard>
      <Banner
        tone="neutral"
        icon="lock"
        title="Privacy"
        message="When notifications arrive, the lock screen will never show patient details."
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  well: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
});
