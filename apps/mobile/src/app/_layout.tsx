import { DarkTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorFallback } from '@/components/ErrorFallback';
import '@/config/env';
import { devToolsEnabled } from '@/features/dev/flags';
import { SessionProvider, useSession } from '@/features/session/SessionProvider';
import { useReducedMotion } from '@/hooks/useAccessibilitySetting';
import { colors } from '@/theme/tokens';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.backgroundElevated,
    text: colors.text,
    border: colors.border,
  },
};

function Providers({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        {children}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Route access is declared here. Stack.Protected removes routes whose guard is false and
 * redirects away from them, so signed-out users can never render the (app) group.
 * This is a UX boundary only; the API enforces access on every request.
 */
function RootNavigator() {
  const { state } = useSession();
  const reducedMotion = useReducedMotion();
  const signedIn = state.status === 'signed-in';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reducedMotion ? 'none' : 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={devToolsEnabled}>
        <Stack.Screen name="showcase" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </Providers>
  );
}

// Rendered when any route throws while rendering.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <Providers>
      <ErrorFallback error={error} onRetry={retry} />
    </Providers>
  );
}
