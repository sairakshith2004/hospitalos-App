import { Banner, ScreenContainer, ScreenHeader } from '@/components';

/** Placeholder. The request form is built in Step 7. */
export function ForgotPasswordScreen() {
  return (
    <ScreenContainer>
      <ScreenHeader title="Forgot password" />
      <Banner
        tone="neutral"
        title="Prototype"
        message="Password reset is not available yet. No email or SMS is sent."
      />
    </ScreenContainer>
  );
}
