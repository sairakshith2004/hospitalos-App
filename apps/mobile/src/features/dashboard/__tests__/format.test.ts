import { formatDateEyebrow, greetingFor } from '../format';

describe('formatDateEyebrow', () => {
  it('formats weekday, zero-padded day and month in capitals', () => {
    expect(formatDateEyebrow(new Date(2026, 10, 5))).toBe('THURSDAY, 05 NOVEMBER');
  });
});

describe('greetingFor', () => {
  it.each([
    [8, 'Good morning'],
    [13, 'Good afternoon'],
    [19, 'Good evening'],
  ])('hour %i -> %s', (hour, expected) => {
    expect(greetingFor(new Date(2026, 10, 5, hour))).toBe(expected);
  });
});
