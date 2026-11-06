import { newIdempotencyKey } from '../api/hooks';
import { formatPaise, hospitalTime, humanize } from '../format';

describe('formatPaise', () => {
  it.each([
    [0, '₹0.00'],
    [5, '₹0.05'],
    [50000, '₹500.00'],
    [123456789, '₹12,34,567.89'],
    [100000000, '₹10,00,000.00'],
    [-2500, '−₹25.00'],
  ])('%i paise is %s', (paise, text) => {
    expect(formatPaise(paise)).toBe(text);
  });
});

describe('hospitalTime, humanize and idempotency keys', () => {
  it('shows times in Asia/Kolkata', () => {
    expect(hospitalTime('2026-11-06T03:30:00.000Z')).toBe('09:00');
    expect(hospitalTime('2026-11-06T18:45:00.000Z')).toBe('00:15');
  });
  it('turns status codes into words', () => {
    expect(humanize('checked_in')).toBe('Checked in');
  });
  it('makes unique UUID v4 keys', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(200);
    for (const key of keys)
      expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
