// Tests run with a fixed, valid config so the fail-fast check in src/config/env.ts passes.
process.env.EXPO_PUBLIC_APP_ENV = 'development';

// Icon fonts load asynchronously in the app; report them as loaded so tests stay synchronous.
jest.mock('expo-font', () => ({
  ...jest.requireActual<object>('expo-font'),
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(() => Promise.resolve()),
}));
