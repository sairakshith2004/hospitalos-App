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
  /** Base URL of the HospitalOS API (public, not a secret). HTTPS outside development. */
  apiUrl: string;
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

const DEFAULT_DEV_API_URL = 'http://127.0.0.1:4000';

function parseApiUrl(value: string | undefined, appEnv: AppEnv): string {
  const raw = value?.trim() || (appEnv === 'development' ? DEFAULT_DEV_API_URL : '');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(
      'EXPO_PUBLIC_API_URL must be a full URL, for example https://api.example.org.',
    );
  }
  if (url.protocol !== 'https:' && !(appEnv === 'development' && url.protocol === 'http:')) {
    throw new ConfigError('EXPO_PUBLIC_API_URL must use HTTPS outside development.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigError(
      'EXPO_PUBLIC_API_URL must not contain credentials, a query or a fragment.',
    );
  }
  return url.origin;
}

/** Pure parser so it can be tested without touching process.env. */
export function parseConfig(env: RawEnv): AppConfig {
  const appEnv = parseAppEnv(env.EXPO_PUBLIC_APP_ENV);
  return Object.freeze({ appEnv, apiUrl: parseApiUrl(env.EXPO_PUBLIC_API_URL, appEnv) });
}

// Expo only inlines EXPO_PUBLIC_* variables accessed with static dot notation,
// so each variable is read explicitly here rather than passing process.env through.
export const config: AppConfig = parseConfig({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
});
