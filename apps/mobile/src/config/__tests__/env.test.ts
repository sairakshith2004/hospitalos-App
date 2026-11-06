import { ConfigError, parseConfig } from '@/config/env';

describe('parseConfig', () => {
  it('accepts each supported environment', () => {
    expect(parseConfig({ EXPO_PUBLIC_APP_ENV: 'development' }).appEnv).toBe('development');
    const https = { EXPO_PUBLIC_API_URL: 'https://api.hospital.example' };
    expect(parseConfig({ EXPO_PUBLIC_APP_ENV: 'staging', ...https }).appEnv).toBe('staging');
    expect(parseConfig({ EXPO_PUBLIC_APP_ENV: ' production ', ...https }).appEnv).toBe(
      'production',
    );
  });

  it('defaults the API to the local server in development only', () => {
    expect(parseConfig({ EXPO_PUBLIC_APP_ENV: 'development' }).apiUrl).toBe(
      'http://127.0.0.1:4000',
    );
    expect(() => parseConfig({ EXPO_PUBLIC_APP_ENV: 'production' })).toThrow(ConfigError);
  });

  it('requires HTTPS outside development and refuses credentials in the URL', () => {
    expect(() =>
      parseConfig({
        EXPO_PUBLIC_APP_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'http://api.hospital.example',
      }),
    ).toThrow(/HTTPS/);
    expect(() =>
      parseConfig({
        EXPO_PUBLIC_APP_ENV: 'production',
        EXPO_PUBLIC_API_URL: 'https://user:pass@api.example',
      }),
    ).toThrow(/credentials/);
    expect(
      parseConfig({
        EXPO_PUBLIC_APP_ENV: 'development',
        EXPO_PUBLIC_API_URL: 'http://10.0.2.2:4000/',
      }).apiUrl,
    ).toBe('http://10.0.2.2:4000');
  });

  it('fails fast when the variable is missing or blank', () => {
    expect(() => parseConfig({})).toThrow(ConfigError);
    expect(() => parseConfig({ EXPO_PUBLIC_APP_ENV: '  ' })).toThrow(/not set/);
  });

  it('rejects unknown values', () => {
    expect(() => parseConfig({ EXPO_PUBLIC_APP_ENV: 'prod' })).toThrow(/must be one of/);
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(parseConfig({ EXPO_PUBLIC_APP_ENV: 'development' }))).toBe(true);
  });
});
