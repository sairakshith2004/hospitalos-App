import { changePasswordRequestSchema } from '@hospitalos/contracts';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

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
import { describeError } from '@/services/api/errors';
import {
  schemaFieldErrors,
  serverFieldErrors,
  type FieldMessages,
} from '@/services/api/form-errors';

type Props = Readonly<{ forced: boolean }>;

/**
 * Change own password. Forced after HR or an operator set it (the only screen available until done);
 * voluntary from Profile. Other devices are signed out; this one stays signed in.
 */
export function ChangePasswordScreen({ forced }: Props) {
  const router = useRouter();
  const { changePassword, signOut, state } = useSession();
  const stillRequired =
    state.status === 'signed-in' &&
    state.session.kind === 'authenticated' &&
    state.session.mustChangePassword;
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<FieldMessages>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Once the server confirms the new password, the rest of the app opens (the route guard changes
  // with the session, so navigate only after that state has been applied).
  useEffect(() => {
    if (forced && done && !stillRequired) router.replace('/home');
  }, [forced, done, stillRequired, router]);

  async function submit() {
    const parsed = changePasswordRequestSchema.safeParse({ currentPassword, newPassword });
    const local = { ...schemaFieldErrors(parsed) };
    if (confirm !== newPassword) local.confirm = 'The passwords do not match.';
    setFields(local);
    if (!parsed.success || confirm !== newPassword) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
      setDone(true);
      if (!forced) router.back();
    } catch (caught) {
      const serverFields = serverFieldErrors(caught);
      setFields(serverFields);
      if (Object.keys(serverFields).length === 0) setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title={forced ? 'Choose a new password' : 'Change password'} />
      {forced ? (
        <Banner
          tone="warning"
          title="New password needed"
          message="Your password was set by someone else. Choose your own to continue."
        />
      ) : null}
      <SurfaceCard>
        <TextField
          label={forced ? 'Password you were given' : 'Current password'}
          value={currentPassword}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="current-password"
          errorText={fields.currentPassword}
          disabled={busy}
        />
        <TextField
          label="New password"
          helperText="At least 12 characters, not your username."
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
          <Banner tone="danger" title="Could not change the password" message={error} />
        ) : null}
        {done && forced ? <AppText color="textSecondary">Password changed.</AppText> : null}
        <PrimaryButton
          label="Save new password"
          fullWidth
          loading={busy}
          onPress={() => void submit()}
        />
      </SurfaceCard>
      {forced ? <SecondaryButton label="Sign out" onPress={() => void signOut()} /> : null}
    </ScreenContainer>
  );
}
