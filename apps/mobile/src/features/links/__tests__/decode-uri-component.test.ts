/**
 * KI-12: the bundled `decode-uri-component` is a linear-time local copy (shims/), resolved by
 * metro.config.js and the Jest moduleNameMapper. These tests prove the vulnerable original is not
 * what query-string (used by Expo Router) loads, that valid input decodes exactly as before, and
 * that the measured attack payloads finish quickly.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
type Decode = (input: string) => string;
const safeDecode: Decode = require('decode-uri-component');
const untypedDecode: (input: unknown) => string = require('decode-uri-component');
const shim: Decode = require('../../../../shims/decode-uri-component');
// The installed original, loaded by file path so the mapper does not redirect it.
const originalDecode: Decode = require('decode-uri-component/index.js');
// The query-string that Expo Router loads (hoisted; expo-router has no nested copy).
const queryString: { parse: (query: string) => Record<string, unknown> } = require('query-string');
/* eslint-enable @typescript-eslint/no-require-imports */

const ATTACK_LENGTHS = [300, 1000, 3000];

describe('decode-uri-component replacement (KI-12)', () => {
  it('is the local shim, not the vulnerable package', () => {
    expect(safeDecode).toBe(shim);
    expect(safeDecode).not.toBe(originalDecode);
  });

  it.each([
    'Ravi%20Kumar',
    'a+b',
    '%E2%82%B9500',
    '%F0%9F%98%80',
    'plain',
    '',
    '%25',
    'x%2Fy%3Fz%3D1%26w',
  ])('decodes valid input %p exactly like the original', (input) => {
    expect(safeDecode(input)).toBe(originalDecode(input));
  });

  it.each([
    ['%', '%'],
    ['%zz', '%zz'],
    ['%C2', '%C2'],
    ['abc%E2%82', 'abc%E2%82'],
    ['%E2%82%B9%C2x', '₹%C2x'],
    ['%C3%A9%FF%C3%A9', 'é%FFé'],
    ['%ED%A0%80', '%ED%A0%80'], // lone surrogate
    ['%C0%AF', '%C0%AF'], // overlong
  ])('never throws on malformed %p and keeps undecodable escapes', (input, expected) => {
    expect(safeDecode(input)).toBe(expected);
  });

  it('rejects non-string input like the original', () => {
    expect(() => untypedDecode(42)).toThrow(TypeError);
  });

  it.each(ATTACK_LENGTHS)('decodes a %d-escape attack payload in linear time', (count) => {
    const start = Date.now();
    safeDecode('%C2'.repeat(count));
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('is what query-string (Expo Router) uses: the 3,000-escape payload no longer freezes', () => {
    const start = Date.now();
    const parsed = queryString.parse('q=' + '%C2'.repeat(3000));
    expect(Date.now() - start).toBeLessThan(100);
    expect(typeof parsed.q).toBe('string');
    expect(queryString.parse('q=Ravi%20Kumar&x=%E2%82%B9')).toEqual({ q: 'Ravi Kumar', x: '₹' });
  });
});
