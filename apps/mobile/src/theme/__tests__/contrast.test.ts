/**
 * WCAG 2.x contrast for the design tokens, computed from the values themselves so the palette
 * can't drift below AA by eye. Text needs 4.5:1; `textDisabled` is exempt (disabled controls).
 */
import { colors, palette, toneColors } from '@/theme/tokens';

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}
function contrast(a: string, b: string): number {
  const hi = Math.max(luminance(a), luminance(b));
  const lo = Math.min(luminance(a), luminance(b));
  return (hi + 0.05) / (lo + 0.05);
}
/** Alpha-blends an rgba() fill over an opaque hex surface. */
function over(rgba: string, base: string): string {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(rgba);
  if (!m) return rgba;
  const a = Number(m[4]);
  const b = Number.parseInt(base.slice(1), 16);
  const mix = (c: number, shift: number) =>
    Math.round(c * a + ((b >> shift) & 255) * (1 - a))
      .toString(16)
      .padStart(2, '0');
  return `#${mix(Number(m[1]), 16)}${mix(Number(m[2]), 8)}${mix(Number(m[3]), 0)}`;
}

const SURFACES = {
  background: colors.background,
  backgroundElevated: colors.backgroundElevated,
  surfaceStrong: colors.surfaceStrong,
  surfaceRaised: colors.surfaceRaised,
  surfacePressed: colors.surfacePressed,
};
const TEXT = {
  text: colors.text,
  textSecondary: colors.textSecondary,
  textMuted: colors.textMuted,
  primary: colors.primary,
  secondary: colors.secondary,
  info: colors.info,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
};

describe('design token contrast (WCAG AA)', () => {
  it('uses the approved midnight-navy palette', () => {
    expect(colors.background).toBe('#080F1D');
    expect(colors.surfaceStrong).toBe('#111E32');
    expect(colors.surfaceRaised).toBe('#192840');
    expect(colors.primary).toBe('#35D5E6');
    expect(colors.secondary).toBe('#9D90FF');
    expect(colors.text).toBe('#F4F7FC');
    expect(colors.textMuted).toBe('#8494AB');
    expect(colors.textDisabled).toBe('#64748B');
  });

  for (const [surfaceName, surface] of Object.entries(SURFACES)) {
    for (const [textName, text] of Object.entries(TEXT)) {
      it(`${textName} on ${surfaceName} is at least 4.5:1`, () => {
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('keeps filled-button text readable (navy on cyan, navy on rose)', () => {
    expect(contrast(colors.textOnAccent, colors.primary)).toBeGreaterThanOrEqual(7);
    expect(contrast(colors.textOnAccent, colors.danger)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps every status chip label at least 4.5:1 on its tint over a card', () => {
    for (const { fg, bg } of Object.values(toneColors)) {
      expect(contrast(fg, over(bg, colors.surfaceStrong))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('restricts textDisabled to disabled controls (below AA by design)', () => {
    expect(contrast(colors.textDisabled, colors.surfaceStrong)).toBeLessThan(4.5);
    expect(palette.ink500).toBe(colors.textDisabled);
  });
});
