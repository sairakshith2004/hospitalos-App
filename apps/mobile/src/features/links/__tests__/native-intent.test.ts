import { redirectSystemPath } from '@/app/+native-intent';

// Minimal local types: this project loads only Jest's global types, not Node's.
declare const __dirname: string;
const fs = jest.requireActual<{ readFileSync(path: string, encoding: 'utf8'): string }>('fs');
const path = jest.requireActual<{ join(...segments: string[]): string }>('path');

function withDev<T>(value: boolean, run: () => T): T {
  const previous = __DEV__;
  Object.defineProperty(globalThis, '__DEV__', { value, configurable: true, writable: true });
  try {
    return run();
  } finally {
    Object.defineProperty(globalThis, '__DEV__', {
      value: previous,
      configurable: true,
      writable: true,
    });
  }
}

describe('+native-intent redirectSystemPath', () => {
  it('passes allowed links through, on first launch and later', () => {
    expect(redirectSystemPath({ path: 'hospitalos://inbox', initial: true })).toBe('/inbox');
    expect(redirectSystemPath({ path: 'hospitalos://home', initial: false })).toBe('/home');
  });

  it('sends unsafe links to the normal entry point', () => {
    for (const link of ['javascript:alert(1)', 'https://evil.example', 'hospitalos://sign-out']) {
      expect(redirectSystemPath({ path: link, initial: false })).toBe('/');
    }
  });

  it('stays active in production builds and rejects Expo Go links there', () => {
    withDev(false, () => {
      expect(redirectSystemPath({ path: 'hospitalos://queue', initial: true })).toBe('/queue');
      expect(redirectSystemPath({ path: 'exp://10.0.0.2:8081/--/queue', initial: true })).toBe('/');
      expect(redirectSystemPath({ path: 'https://evil.example', initial: false })).toBe('/');
    });
    withDev(true, () => {
      expect(redirectSystemPath({ path: 'exp://10.0.0.2:8081/--/queue', initial: true })).toBe(
        '/queue',
      );
    });
  });

  it('never throws, whatever it receives', () => {
    for (const value of [undefined, null, 42, {}, 'x'.repeat(100_000)]) {
      // @ts-expect-error -- deliberately wrong input: the handler must survive it.
      expect(redirectSystemPath({ path: value, initial: false })).toBe('/');
    }
  });

  it('is not switched off by any build flag', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'app', '+native-intent.ts'),
      'utf8',
    );
    expect(source).toContain('guardIncomingLink(path,');
    expect(source).not.toMatch(/if\s*\(\s*!?__DEV__\s*\)\s*return/);
    expect(source).not.toMatch(/process\.env/);
  });
});
