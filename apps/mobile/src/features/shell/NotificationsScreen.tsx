import { AppText, Banner, EmptyState, ScreenContainer } from '@/components';

export function NotificationsScreen() {
  return (
    <ScreenContainer bottomInset={false}>
      <AppText variant="title" accessibilityRole="header">
        Notifications
      </AppText>
      <Banner
        tone="neutral"
        icon="lock"
        title="Privacy"
        message="Notifications never show patient details on the lock screen."
      />
      <EmptyState
        icon="notifications"
        title="You're all caught up"
        message="In-app notifications arrive in a later step."
      />
    </ScreenContainer>
  );
}
