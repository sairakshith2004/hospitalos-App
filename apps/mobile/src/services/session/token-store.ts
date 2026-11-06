import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The refresh token lives only in the platform keystore (Android Keystore / iOS Keychain), readable
 * only while the device is unlocked and never included in backups or moved to another device
 * (architecture §5.5). The access token is never stored anywhere.
 */
const KEY = 'hospitalos.refresh-token';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type TokenStore = Readonly<{
  read: () => Promise<string | null>;
  write: (token: string) => Promise<void>;
  clear: () => Promise<void>;
}>;

const keystore: TokenStore = {
  read: () => SecureStore.getItemAsync(KEY, OPTIONS),
  write: (token) => SecureStore.setItemAsync(KEY, token, OPTIONS),
  clear: () => SecureStore.deleteItemAsync(KEY, OPTIONS),
};

/** Web has no keystore: keep the token in memory only (lost when the tab closes). Never localStorage. */
function memoryStore(): TokenStore {
  let token: string | null = null;
  return {
    read: () => Promise.resolve(token),
    write: (next) => {
      token = next;
      return Promise.resolve();
    },
    clear: () => {
      token = null;
      return Promise.resolve();
    },
  };
}

export const secureTokenStore: TokenStore = Platform.OS === 'web' ? memoryStore() : keystore;
