import { forgotPasswordRequestSchema, resetPasswordRequestSchema } from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import {
  AppText,
  Banner,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SecondaryButton,
  SurfaceCard,
  TextField,
} from '@/components';
import { useSession } from '@/features/session/SessionProvider';
import { ApiError, describeError } from '@/services/api/errors';
import {
  schemaFieldErrors,
  serverFieldErrors,
  type FieldMessages,
} from '@/services/api/form-errors';

type Step = 'request' | 'reset' | 'done';

/**
 * Forgot password by one-time code (architecture §5.4). The answer to a request is the same whether
 * or not the account exists, so this screen never says whether a code was sent.
 */
export function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset, resetPassword } = useSession();
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<FieldMessages>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    const parsed = forgotPasswordRequestSchema.safeParse({ identifier });
    setFields(schemaFieldErrors(parsed));
    if (!parsed.success) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(parsed.data.identifier);
      setStep('reset');
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    const parsed = resetPasswordRequestSchema.safeParse({ identifier, code, newPassword });
    const local = { ...schemaFieldErrors(parsed) };
    if (confirm !== newPassword) local.confirm = 'The passwords do not match.';
    setFields(local);
    if (!parsed.success || confirm !== newPassword) return;
    setBusy(true);
    setError(null);
    try {
      await resetPassword(parsed.data.identifier, parsed.data.code, parsed.data.newPassword);
      setStep('done');
    } catch (caught) {
      setFields(serverFieldErrors(caught));
      setError(
        caught instanceof ApiError && caught.code === 'INVALID_RESET_CODE'
          ? 'The code is not valid or has expired. Request a new one.'
          : describeError(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Forgot password" eyebrow="ACCOUNT" />
      {step === 'request' ? (
        <SurfaceCard>
          <AppText color="textSecondary">
            Enter your username or work email. If the account has a work email, we send an 8-digit
            code to it. It expires in 15 minutes.
          </AppText>
          <TextField
            label="Username or work email"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            errorText={fields.identifier}
            disabled={busy}
          />
          {error !== null ? (
            <Banner tone="danger" title="Something went wrong" message={error} />
          ) : null}
          <PrimaryButton
            label="Send code"
            fullWidth
            loading={busy}
            onPress={() => void request()}
          />
        </SurfaceCard>
      ) : null}

      {step === 'reset' ? (
        <SurfaceCard>
          <Banner
            tone="neutral"
            title="Check your work email"
            message="If the account exists and has a work email, a code is on its way. Staff without a work email can ask HR or an administrator."
          />
          <TextField
            label="8-digit code"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            errorText={fields.code}
            disabled={busy}
          />
          <TextField
            label="New password"
            helperText="At least 12 characters."
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            errorText={fields.newPassword}
            disabled={busy}
          />
          <TextField
            label="New password again"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            errorText={fields.confirm}
            disabled={busy}
          />
          {error !== null ? (
            <Banner tone="danger" title="Could not reset the password" message={error} />
          ) : null}
          <PrimaryButton
            label="Set new password"
            fullWidth
            loading={busy}
            onPress={() => void reset()}
          />
          <SecondaryButton label="Send a new code" onPress={() => setStep('request')} />
        </SurfaceCard>
      ) : null}

      {step === 'done' ? (
        <SurfaceCard>
          <Banner
            tone="success"
            title="Password changed"
            message="Every device that was signed in to this account has been signed out."
          />
          <PrimaryButton
            label="Back to sign in"
            fullWidth
            onPress={() => router.replace('/sign-in')}
          />
        </SurfaceCard>
      ) : null}
    </ScreenContainer>
  );
}
