import { ConfigError, parseConfig } from '@/config/env';

describe('parseConfig', () => {
  it('accepts each supported environment', () => {
    expect(parseConfig({ EXPO_PUBLIC_APP_ENV: 'development' }).appEnv).toBe('development');
    expect(parseConfig({ EXPO_PUBLIC_APP_ENV: 'staging' }).appEnv).toBe('staging');
    expect(parseConfig({ EXPO_PUBLIC_APP_ENV: ' production ' }).appEnv).toBe('production');
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
