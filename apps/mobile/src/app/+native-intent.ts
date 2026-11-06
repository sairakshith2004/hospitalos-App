import { SAFE_FALLBACK, guardIncomingLink } from '@/features/links/link-guard';

/**
 * Expo Router calls this for every link that opens or reaches the app, before it parses the link
 * (AD-M-017). Only allowed in-app destinations pass; anything else opens the normal entry point.
 * Always active: production builds accept only the hospitalos: scheme. It never throws: any
 * unexpected input opens the entry point instead of crashing the app.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return guardIncomingLink(path, { allowDevSchemes: __DEV__ });
  } catch {
    return SAFE_FALLBACK;
  }
}
