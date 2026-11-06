import {
  ALLOWED_DESTINATIONS,
  MAX_LINK_LENGTH,
  SAFE_FALLBACK,
  evaluateIncomingLink,
  guardIncomingLink,
} from '@/features/links/link-guard';

// Minimal local types: this project loads only Jest's global types, not Node's.
declare const __dirname: string;
const fs = jest.requireActual<{ existsSync(path: string): boolean }>('fs');
const path = jest.requireActual<{ join(...segments: string[]): string }>('path');

const PROD = { allowDevSchemes: false } as const;
const DEV = { allowDevSchemes: true } as const;

describe('allowed links', () => {
  it.each([
    ['hospitalos://home', '/home'],
    ['hospitalos:///home', '/home'],
    ['hospitalos:home', '/home'],
    ['HOSPITALOS://home', '/home'], // schemes are case-insensitive
    ['hospitalos://', '/'],
    ['hospitalos:///', '/'],
    ['hospitalos://sign-in', '/sign-in'],
    ['hospitalos://forgot-password', '/forgot-password'],
    ['hospitalos://queue', '/queue'],
    ['hospitalos://search', '/search'],
    ['hospitalos://inbox', '/inbox'],
    ['hospitalos://profile/', '/profile'],
    ['hospitalos://home//', '/home'], // trailing slashes are trimmed
    ['/home', '/home'],
    ['/', '/'],
  ])('%s opens %s', (link, expected) => {
    expect(evaluateIncomingLink(link, PROD)).toEqual({ allowed: true, path: expected });
  });

  it('drops query strings and fragments instead of passing them on', () => {
    expect(guardIncomingLink('hospitalos://search?q=Ravi%20Kumar', PROD)).toBe('/search');
    expect(guardIncomingLink('hospitalos://home#section', PROD)).toBe('/home');
    expect(guardIncomingLink('hospitalos://inbox?next=https://evil.example', PROD)).toBe('/inbox');
  });

  it('accepts Expo Go links only in development builds', () => {
    expect(guardIncomingLink('exp://192.168.1.10:8081/--/home', DEV)).toBe('/home');
    expect(guardIncomingLink('exp://192.168.1.10:8081', DEV)).toBe('/');
    expect(guardIncomingLink('exps://u.expo.dev/--/inbox', DEV)).toBe('/inbox');
    expect(evaluateIncomingLink('exp://192.168.1.10:8081/--/home', PROD)).toEqual({
      allowed: false,
      reason: 'scheme-not-allowed',
    });
  });
});

describe('rejected links', () => {
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'intent://scan/#Intent;scheme=zxing;package=com.evil;end',
    'content://com.android.contacts/contacts',
    'http://evil.example/home',
    'https://evil.example/home',
    'mailto:someone@example.com',
    'tel:+911234567890',
    'sms:+911234567890',
    'vbscript:msgbox(1)',
    'blob:https://evil.example/uuid',
    'ws://evil.example',
    'hospitalos-evil://home',
    'exp+hospitalos://home',
  ])('%s: unsafe or unknown scheme', (link) => {
    expect(evaluateIncomingLink(link, DEV)).toEqual({
      allowed: false,
      reason: 'scheme-not-allowed',
    });
    expect(guardIncomingLink(link, PROD)).toBe(SAFE_FALLBACK);
  });

  it.each([
    ['//evil.example/home', 'not-a-link'], // protocol-relative: would leave the app on web
    ['evil.example/home', 'not-a-link'],
    ['', 'not-a-link'],
    ['hospitalos://home\\..\\sign-out', 'unsafe-characters'],
    ['hospitalos://home\nhttps://evil.example', 'unsafe-characters'],
    ['hospitalos://home\r\n', 'unsafe-characters'],
    ['hospitalos://ho\u0000me', 'unsafe-characters'],
    ['hospitalos://ho\u007fme', 'unsafe-characters'],
    ['hospitalos://home page', 'unsafe-characters'],
    ['hospitalos://home?q=%E0%A4%A', 'malformed-encoding'],
    ['hospitalos://home?q=%', 'malformed-encoding'],
    ['hospitalos://search?q=' + '%C2'.repeat(600), 'malformed-encoding'], // KI-12 payload
    ['hospitalos://search?q=' + '%C2'.repeat(1000), 'too-long'], // KI-12 payload, longer
  ])('%j is rejected (%s)', (link, reason) => {
    expect(evaluateIncomingLink(link, DEV)).toEqual({ allowed: false, reason });
    expect(guardIncomingLink(link, PROD)).toBe(SAFE_FALLBACK);
  });

  it.each([
    'hospitalos://role-preview', // development tool
    'hospitalos://showcase', // development tool
    'hospitalos://sign-out', // forced sign-out from a link
    'hospitalos://settings',
    'hospitalos://modules/billing',
    'hospitalos://home/../sign-out',
    'hospitalos://./home',
    'hospitalos://%68ome', // encoded "home"
    'hospitalos://Home',
    'hospitalos://home/extra',
    'hospitalos://evil.example',
    '/sign-out',
    '/role-preview',
  ])('%s: destination not on the allow-list', (link) => {
    expect(evaluateIncomingLink(link, DEV)).toEqual({
      allowed: false,
      reason: 'destination-not-allowed',
    });
    expect(guardIncomingLink(link, PROD)).toBe(SAFE_FALLBACK);
  });

  it('refuses links longer than the limit', () => {
    const long = 'hospitalos://home?' + 'a'.repeat(MAX_LINK_LENGTH);
    expect(evaluateIncomingLink(long, PROD)).toEqual({ allowed: false, reason: 'too-long' });
  });

  it('refuses values that are not strings', () => {
    for (const value of [undefined, null, 42, {}, ['hospitalos://home']]) {
      expect(evaluateIncomingLink(value, PROD)).toEqual({ allowed: false, reason: 'not-a-string' });
    }
  });

  it('decides on the KI-12 freezing payload in well under a millisecond per link', () => {
    const payload = 'hospitalos://search?q=' + '%C2'.repeat(600); // freezes query-string for ~0.3 s
    const start = Date.now();
    for (let i = 0; i < 100; i += 1) guardIncomingLink(payload, PROD);
    expect(Date.now() - start).toBeLessThan(100);
  });
});

describe('adversarial parameters, hosts and encodings', () => {
  it.each([
    'hospitalos://home?role=SA&role=SA', // repeated parameters
    'hospitalos://home?permissions=*&userId=00000000-0000-0000-0000-000000000000', // client-supplied identity
    'hospitalos://search?q=a&q=b&q=c',
    'hospitalos://home?__proto__[admin]=true',
    'hospitalos://home?redirect=https%3A%2F%2Fevil.example',
  ])('%s opens the destination with every parameter dropped', (link) => {
    const result = guardIncomingLink(link, PROD);
    expect(ALLOWED_DESTINATIONS).toContain(result);
    expect(result).not.toContain('?');
  });

  it.each([
    'hospitalos://evil.example/home', // unexpected host before the path
    'hospitalos://user:pass@home',
    'hospitalos://home:8080',
    'hospitalos://localhost/home',
    'hospitalos://%2F%2Fevil.example',
    'hospitalos://%2e%2e/sign-out',
    'hospitalos://home%2F..%2Fsign-out',
    'hospitalos://h%00ome',
    'hospitalos://%E2%80%AEemoh', // right-to-left override
  ])('%s is not an allowed destination', (link) => {
    expect(evaluateIncomingLink(link, PROD).allowed).toBe(false);
    expect(guardIncomingLink(link, PROD)).toBe(SAFE_FALLBACK);
  });
});

describe('results', () => {
  it('only ever returns an internal, allow-listed path', () => {
    const samples = [
      'hospitalos://home',
      'https://evil.example',
      '//evil.example',
      'javascript:alert(1)',
      'hospitalos://sign-out',
      'garbage',
    ];
    for (const link of samples) {
      for (const options of [PROD, DEV]) {
        const result = guardIncomingLink(link, options);
        expect(ALLOWED_DESTINATIONS).toContain(result);
        expect(result.startsWith('/')).toBe(true);
        expect(result.startsWith('//')).toBe(false);
      }
    }
  });

  it('never allows a development tool, sign-out or settings as a destination', () => {
    for (const blocked of ['/role-preview', '/showcase', '/sign-out', '/settings']) {
      expect(ALLOWED_DESTINATIONS).not.toContain(blocked);
    }
  });

  it('allows only destinations that exist as screens', () => {
    const app = path.join(__dirname, '..', '..', '..', 'app');
    const screen: Record<string, string> = {
      '/': 'index.tsx',
      '/sign-in': '(auth)/sign-in.tsx',
      '/forgot-password': '(auth)/forgot-password.tsx',
      '/home': '(app)/(tabs)/home.tsx',
      '/queue': '(app)/(tabs)/queue.tsx',
      '/search': '(app)/(tabs)/search.tsx',
      '/inbox': '(app)/(tabs)/inbox.tsx',
      '/profile': '(app)/(tabs)/profile.tsx',
    };
    for (const destination of ALLOWED_DESTINATIONS) {
      const file = screen[destination];
      expect(file).toBeDefined();
      expect(fs.existsSync(path.join(app, file ?? 'missing'))).toBe(true);
    }
  });
});
