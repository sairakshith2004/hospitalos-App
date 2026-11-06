import { Stack, type ErrorBoundaryProps } from 'expo-router';

import { ErrorFallback } from '@/components/ErrorFallback';
import { devToolsEnabled } from '@/features/dev/flags';
import { useSession } from '@/features/session/SessionProvider';
import { colors } from '@/theme/tokens';

/** Protected area. Only reachable while signed in (see the root layout). */
export default function AppLayout() {
  const { state } = useSession();
  // HR or an operator set this password: only "Choose a new password" (and sign-out) is reachable
  // until the person sets their own. The API enforces the same rule (PASSWORD_CHANGE_REQUIRED).
  const mustChange =
    state.status === 'signed-in' &&
    state.session.kind === 'authenticated' &&
    state.session.mustChangePassword;

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={mustChange}>
        <Stack.Screen name="change-password" />
      </Stack.Protected>
      <Stack.Protected guard={!mustChange}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="modules/[moduleId]" />
        <Stack.Screen name="account/password" />
        <Stack.Screen name="patients/register" />
        <Stack.Screen name="patients/[id]/index" />
        <Stack.Screen name="patients/[id]/chart" />
        <Stack.Screen name="book" />
        <Stack.Screen name="follow-ups" />
        <Stack.Screen name="encounters/[id]" />
        <Stack.Screen name="vitals/[appointmentId]" />
        <Stack.Screen name="prescriptions/[id]" />
        <Stack.Screen name="lab-orders/[id]" />
        <Stack.Screen name="invoices/[id]" />
        <Stack.Screen name="admin/staff" />
        <Stack.Screen name="admin/nurse-assignments" />
      </Stack.Protected>
      <Stack.Screen
        name="sign-out"
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Protected guard={devToolsEnabled}>
        <Stack.Screen name="role-preview" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorFallback error={error} onRetry={retry} />;
}
