import { describe, expect, it } from 'vitest';

import { instant, postgresErrorOf, timestamptz } from '../src/db/sql';

describe('timestamp parsing', () => {
  it.each([
    ['2026-11-06 10:00:00.123+00', '2026-11-06T10:00:00.123Z'],
    ['2026-11-06 15:30:00+05:30', '2026-11-06T10:00:00.000Z'],
    ['2026-11-06 15:30:00+0530', '2026-11-06T10:00:00.000Z'],
    ['2026-11-06T10:00:00Z', '2026-11-06T10:00:00.000Z'],
  ])('%s is %s', (input, expected) => {
    expect(timestamptz.parse(input)).toBe(expected);
  });

  it('accepts Date objects and rejects anything else', () => {
    expect(instant.parse(new Date(0)).toISOString()).toBe('1970-01-01T00:00:00.000Z');
    expect(instant.safeParse('yesterday').success).toBe(false);
    expect(instant.safeParse('2026-11-06').success).toBe(false);
  });
});

describe('postgresErrorOf', () => {
  it('finds the PostgreSQL error inside wrappers and ignores other errors', () => {
    const pg = Object.assign(new Error('duplicate'), {
      code: '23505',
      constraint: 'users_username_key',
    });
    expect(postgresErrorOf(new Error('Failed query', { cause: pg }))).toEqual({
      code: '23505',
      constraint: 'users_username_key',
    });
    expect(postgresErrorOf(new Error('plain'))).toBeUndefined();
    expect(
      postgresErrorOf(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })),
    ).toBeUndefined();
  });
});
