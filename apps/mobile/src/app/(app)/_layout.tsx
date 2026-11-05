import { Stack, type ErrorBoundaryProps } from 'expo-router';

import { ErrorFallback } from '@/components/ErrorFallback';
import { devToolsEnabled } from '@/features/dev/flags';
import { colors } from '@/theme/tokens';

/** Protected area. Only reachable while signed in (see the root layout). */
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="modules/[moduleId]" />
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
