import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { config } from '@/config/env';

import { createSessionManager, type SessionManager } from './session-manager';
import { secureTokenStore } from './token-store';

/** The app's single session manager (one per app run). */
let instance: SessionManager | undefined;
const endedListeners = new Set<() => void>();

export function appSessionManager(): SessionManager {
  instance ??= createSessionManager({
    baseUrl: config.apiUrl,
    store: secureTokenStore,
    appVersion: Constants.expoConfig?.version ?? '0.0.0',
    platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    onSessionEnded: () => {
      for (const listener of endedListeners) listener();
    },
  });
  return instance;
}

/** Notified when the server ends the session (refresh refused); the app returns to sign-in. */
export function onSessionEnded(listener: () => void): () => void {
  endedListeners.add(listener);
  return () => endedListeners.delete(listener);
}

/** A short device name shown in My Devices; never contains anything personal. */
export function deviceLabel(): string {
  const name = Constants.deviceName?.trim();
  if (name) return name.slice(0, 80);
  return Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Android phone' : 'Browser';
}
