/**
 * Typed, validated app configuration.
 *
 * EXPO_PUBLIC_* values are inlined into the JavaScript bundle at build time and are
 * readable by anyone with the app. Never put secrets, tokens or credentials here.
 */

export const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export type AppConfig = Readonly<{
  appEnv: AppEnv;
}>;

export type RawEnv = Readonly<Record<string, string | undefined>>;

export class ConfigError extends Error {
  override name = 'ConfigError';
}

function parseAppEnv(value: string | undefined): AppEnv {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new ConfigError(
      'EXPO_PUBLIC_APP_ENV is not set. Copy .env.example to .env and restart Expo with --clear.',
    );
  }
  const match = APP_ENVS.find((env) => env === trimmed);
  if (!match) {
    throw new ConfigError(
      `EXPO_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(', ')}; received "${trimmed}".`,
    );
  }
  return match;
}

/** Pure parser so it can be tested without touching process.env. */
export function parseConfig(env: RawEnv): AppConfig {
  return Object.freeze({
    appEnv: parseAppEnv(env.EXPO_PUBLIC_APP_ENV),
  });
}

// Expo only inlines EXPO_PUBLIC_* variables accessed with static dot notation,
// so each variable is read explicitly here rather than passing process.env through.
export const config: AppConfig = parseConfig({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
});
