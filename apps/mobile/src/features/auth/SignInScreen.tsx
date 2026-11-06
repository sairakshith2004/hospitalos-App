import { useRouter } from 'expo-router';
import { useState } from 'react';

import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  BrandMark,
  GhostButton,
  GlassCard,
  Icon,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SurfaceCard,
  TextField,
} from '@/components';
import { devToolsEnabled } from '@/features/dev/flags';
import { useSession } from '@/features/session/SessionProvider';
import { ApiError, describeError } from '@/services/api/errors';
import { colors, iconSize, spacing } from '@/theme/tokens';

function signInMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return 'The username or password is not right.';
    if (error.code === 'RATE_LIMITED')
      return 'Too many attempts. Wait a few minutes and try again.';
    if (error.code === 'APP_UPDATE_REQUIRED')
      return 'This version of the app is too old. Update it to sign in.';
  }
  return describeError(error);
}

/** Staff sign-in. There is no public registration: HR creates every account. */
export function SignInScreen() {
  const router = useRouter();
  const { signIn, startDemoSession } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (caught) {
      setError(signInMessage(caught));
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.brand}>
        <BrandMark size="lg" />
        <AppText variant="overline" color="primary">
          HOSPITALOS
        </AppText>
        <AppText variant="display" accessibilityRole="header">
          Sign in
        </AppText>
        <AppText color="textSecondary" style={styles.centerText}>
          Use the account your hospital gave you.
        </AppText>
      </View>

      <GlassCard tone="hero" padding="lg" enterIndex={0}>
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          returnKeyType="next"
          disabled={busy}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          revealable
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          disabled={busy}
        />
        {error !== null ? <Banner tone="danger" title="Could not sign in" message={error} /> : null}
        <PrimaryButton
          label="Sign in"
          fullWidth
          size="lg"
          loading={busy}
          disabled={!canSubmit}
          onPress={() => void submit()}
        />
        <View style={styles.forgot}>
          <GhostButton label="Forgot password" onPress={() => router.push('/forgot-password')} />
        </View>
      </GlassCard>

      <View style={styles.secure}>
        <Icon name="lock" size={iconSize.xs} color={colors.textMuted} />
        <AppText variant="caption" color="textMuted">
          No public registration. Your hospital creates every account.
        </AppText>
      </View>

      {devToolsEnabled ? (
        <SurfaceCard variant="outline">
          <Banner
            title="DEVELOPMENT ONLY"
            message="Opens a demo workspace with synthetic data. This is not a login and grants no real access."
          />
          <SecondaryButton
            label="Open demo workspace"
            fullWidth
            onPress={() => startDemoSession('hospital-admin')}
          />
        </SurfaceCard>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  centerText: { textAlign: 'center' },
  forgot: { alignItems: 'center' },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
