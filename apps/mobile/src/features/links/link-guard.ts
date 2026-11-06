/**
 * Incoming-link guard (AD-M-017). Every link that opens the app is checked here, through
 * src/app/+native-intent.ts, before Expo Router parses it. It is always on, in production too.
 *
 * Rules:
 * - Only the app's own scheme (`hospitalos:`) is accepted. Expo Go's `exp:` / `exps:` schemes are
 *   accepted only in development builds. Every other scheme (javascript:, data:, file:, intent:,
 *   content:, http:, https:, mailto:, tel:, …) is rejected.
 * - Only the destinations in ALLOWED_DESTINATIONS may be opened from outside the app.
 * - Over-long links, control characters, backslashes and percent-encoding that the built-in
 *   decoder rejects are refused. (The slow decoder behind KI-12 only runs on input the built-in
 *   decoder rejects, so this refusal is what stops a crafted link from freezing the app.)
 * - Query strings and fragments are dropped: no incoming link carries parameters until a
 *   destination needs them and its parameters are validated here.
 *
 * The result is always an internal path. A rejected link opens SAFE_FALLBACK, the normal entry
 * point, which still requires a session for every signed-in screen. This module never opens
 * anything itself and has no way to navigate outside the app.
 */

/** Where rejected links go: the normal entry point (splash, sign-in or home as usual). */
export const SAFE_FALLBACK = '/';

/** Longest incoming link accepted, in characters. */
export const MAX_LINK_LENGTH = 2048;

export const APP_SCHEME = 'hospitalos';

/** Expo Go's own schemes, accepted only in development builds. */
const DEV_SCHEMES = new Set(['exp', 'exps']);

/**
 * The only in-app destinations an incoming link may open. Development tools, sign-out, settings
 * and module pages are deliberately absent. Add a destination only with a review of what it shows
 * and a test.
 */
export const ALLOWED_DESTINATIONS = [
  '/',
  '/sign-in',
  '/forgot-password',
  '/home',
  '/queue',
  '/search',
  '/inbox',
  '/profile',
] as const;

export type AllowedDestination = (typeof ALLOWED_DESTINATIONS)[number];

const ALLOWED = new Set<string>(ALLOWED_DESTINATIONS);

export type RejectionReason =
  | 'not-a-string'
  | 'too-long'
  | 'unsafe-characters'
  | 'malformed-encoding'
  | 'scheme-not-allowed'
  | 'not-a-link'
  | 'destination-not-allowed';

export type LinkDecision =
  | Readonly<{ allowed: true; path: AllowedDestination }>
  | Readonly<{ allowed: false; reason: RejectionReason }>;

export type LinkGuardOptions = Readonly<{
  /** Accept Expo Go's `exp:` / `exps:` links. Pass `__DEV__`; never true in production. */
  allowDevSchemes: boolean;
}>;

// C0 controls, DEL and C1 controls, whitespace, and backslashes (some parsers treat `\` as `/`).
const UNSAFE_CHARACTERS = /[\u0000- \u007f-\u009f\\]/;
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;

function isAllowedDestination(path: string): path is AllowedDestination {
  return ALLOWED.has(path);
}

/** Removes the query string and fragment, then trailing slashes (except for the root). */
function bareDestination(path: string): string {
  const cut = path.search(/[?#]/);
  const withoutQuery = cut === -1 ? path : path.slice(0, cut);
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

type Destination =
  Readonly<{ ok: true; path: string }> | Readonly<{ ok: false; reason: RejectionReason }>;

const reject = (reason: RejectionReason): Destination => ({ ok: false, reason });

/** The in-app path a link points at, or why it has none. */
function destinationOf(link: string, options: LinkGuardOptions): Destination {
  // A bare in-app path, as Expo Router passes in some cases. Never protocol-relative (`//host`).
  if (link.startsWith('/')) {
    return link.startsWith('//') ? reject('not-a-link') : { ok: true, path: link };
  }

  const match = SCHEME.exec(link);
  if (!match) return reject('not-a-link');
  const scheme = (match[1] ?? '').toLowerCase();
  const rest = link.slice(match[0].length);

  if (scheme === APP_SCHEME) {
    // hospitalos://home, hospitalos:///home and hospitalos:home all mean /home.
    return { ok: true, path: '/' + rest.replace(/^\/+/, '') };
  }
  if (options.allowDevSchemes && DEV_SCHEMES.has(scheme)) {
    // Expo Go: exp://192.168.1.10:8081/--/home. Without the /--/ marker it is the app root.
    const marker = rest.indexOf('/--/');
    return { ok: true, path: marker === -1 ? '/' : rest.slice(marker + 3) };
  }
  return reject('scheme-not-allowed');
}

/** Decides whether an incoming link may open the app, and at which destination. */
export function evaluateIncomingLink(link: unknown, options: LinkGuardOptions): LinkDecision {
  if (typeof link !== 'string') return { allowed: false, reason: 'not-a-string' };
  if (link.length > MAX_LINK_LENGTH) return { allowed: false, reason: 'too-long' };
  if (UNSAFE_CHARACTERS.test(link)) return { allowed: false, reason: 'unsafe-characters' };

  try {
    decodeURIComponent(link);
  } catch {
    return { allowed: false, reason: 'malformed-encoding' };
  }

  const destination = destinationOf(link, options);
  if (!destination.ok) return { allowed: false, reason: destination.reason };

  // Exact match only: encoded paths (/%68ome), dot segments (/home/../sign-out), doubled slashes
  // and unknown routes all fall through to a rejection.
  const path = bareDestination(destination.path);
  return isAllowedDestination(path)
    ? { allowed: true, path }
    : { allowed: false, reason: 'destination-not-allowed' };
}

/** The internal path to open for an incoming link: the allowed destination or SAFE_FALLBACK. */
export function guardIncomingLink(link: unknown, options: LinkGuardOptions): AllowedDestination {
  const decision = evaluateIncomingLink(link, options);
  return decision.allowed ? decision.path : SAFE_FALLBACK;
}
