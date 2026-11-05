import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

type Subscription = { remove: () => void };
type Subscribe = (onChange: (enabled: boolean) => void) => Subscription;

function useAccessibilitySetting(query: () => Promise<boolean>, subscribe: Subscribe): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;
    query()
      .then((value) => {
        if (mounted) setEnabled(value);
      })
      .catch(() => {
        // Setting unavailable on this platform; keep the default.
      });
    const subscription = subscribe(setEnabled);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [query, subscribe]);

  return enabled;
}

const subscribeReduceMotion: Subscribe = (onChange) =>
  AccessibilityInfo.addEventListener('reduceMotionChanged', onChange);

// Reduce Transparency is an iOS-only setting; other platforms (and react-native-web,
// which does not implement it) always report false.
const isIOS = Platform.OS === 'ios';

const queryReduceTransparency = (): Promise<boolean> =>
  isIOS ? AccessibilityInfo.isReduceTransparencyEnabled() : Promise.resolve(false);

const subscribeReduceTransparency: Subscribe = (onChange) =>
  isIOS
    ? AccessibilityInfo.addEventListener('reduceTransparencyChanged', onChange)
    : { remove: () => {} };

/** True when the user asked the OS to reduce motion (Android "Remove animations", iOS "Reduce Motion"). */
export function useReducedMotion(): boolean {
  return useAccessibilitySetting(AccessibilityInfo.isReduceMotionEnabled, subscribeReduceMotion);
}

/** True when iOS "Reduce Transparency" is on. Always false on Android. */
export function useReduceTransparency(): boolean {
  return useAccessibilitySetting(queryReduceTransparency, subscribeReduceTransparency);
}
