import { AppText, Banner, EmptyState, ScreenContainer, StatusChip } from '@/components';

/**
 * Inbox: notices, staff messages, doctor call requests and meeting invitations, filtered by the
 * user's permissions. They arrive in Release 7 (video meetings in Release 8). Until then this
 * screen shows only this placeholder: no counts, badges or sample items (docs/MOBILE-PRODUCT-SCOPE.md MD-6).
 */
export function InboxScreen() {
  return (
    <ScreenContainer bottomInset={false}>
      <AppText variant="title" accessibilityRole="header">
        Inbox
      </AppText>
      <StatusChip label="ARRIVES IN RELEASE 7" tone="neutral" dot={false} />
      <EmptyState
        icon="inbox"
        title="Your inbox arrives in Release 7"
        message="Notices, staff messages, doctor call requests and meeting invitations will appear here. Nothing is shown until they come from the hospital server."
      />
      <Banner
        tone="neutral"
        icon="lock"
        title="Privacy"
        message="When notifications arrive, the lock screen will never show patient details."
      />
    </ScreenContainer>
  );
}
