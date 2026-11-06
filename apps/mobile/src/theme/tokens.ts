/**
 * HospitalOS Mobile design tokens.
 *
 * The single source of design values. Screens and components must reference these
 * tokens instead of hard-coding colours, sizes or timings. Full rationale and contrast
 * figures live in docs/DESIGN-SYSTEM.md.
 */
import { StyleSheet, type TextStyle } from 'react-native';

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/** Raw palette (approved midnight-navy direction, 2026-11-06). Prefer the semantic `colors`. */
export const palette = {
  navy950: '#080F1D',
  navy925: '#0D1728',
  navy900: '#111E32',
  navy850: '#192840',
  navy800: '#1C2C46',
  navy700: '#263A5A',
  navy600: '#3A5478',
  navyGlow: '#10264A',
  white: '#FFFFFF',
  ink50: '#F4F7FC',
  ink200: '#B6C3D4',
  ink400: '#8494AB',
  ink500: '#64748B',
  cyan400: '#35D5E6',
  violet400: '#9D90FF',
  blue400: '#6FA8FF',
  emerald400: '#2DD4A3',
  amber400: '#F5B94B',
  rose400: '#FF647C',
} as const;

/**
 * Semantic colours. Measured WCAG 2.x contrast (checked by src/theme/__tests__/contrast.test.ts):
 * on `background` text 17.8:1, textSecondary 10.7:1, textMuted 6.2:1, primary 10.8:1,
 * secondary 7.2:1, success 10.1:1, warning 10.9:1, danger 6.7:1. Every text colour except
 * `textDisabled` passes AA (4.5:1) on all surfaces, including `surfacePressed`.
 * `textDisabled` (#64748B, 3.5–4.0:1) is for disabled controls only, which WCAG exempts.
 */
export const colors = {
  background: palette.navy950,
  backgroundElevated: palette.navy925,
  /** Translucent glass fill used on top of blur (iOS). */
  surface: 'rgba(17, 30, 50, 0.74)',
  /** Opaque surface: cards, inputs, and the glass fallback. */
  surfaceStrong: palette.navy900,
  surfaceRaised: palette.navy850,
  surfacePressed: palette.navy800,
  border: 'rgba(132, 148, 171, 0.16)',
  borderStrong: 'rgba(132, 148, 171, 0.32)',
  borderFocus: palette.cyan400,
  /** Fine top-edge highlight that gives glass surfaces their edge. */
  borderHighlight: 'rgba(255, 255, 255, 0.07)',
  text: palette.ink50,
  textSecondary: palette.ink200,
  textMuted: palette.ink400,
  textDisabled: palette.ink500,
  /** Text/icon colour on filled primary or danger buttons. */
  textOnAccent: palette.navy950,
  primary: palette.cyan400,
  secondary: palette.violet400,
  info: palette.blue400,
  success: palette.emerald400,
  warning: palette.amber400,
  danger: palette.rose400,
  avatar: palette.navy700,
  avatarBorder: palette.navy600,
  skeleton: palette.navy850,
  scrim: 'rgba(4, 8, 16, 0.76)',
  /** Opaque: content must never show through the tab bar (no blur on Android or web). */
  tabBar: palette.navy925,
} as const;

/** Low-opacity fills for chips, icon wells and highlights. */
export const tints = {
  neutral: 'rgba(132, 148, 171, 0.14)',
  primary: 'rgba(53, 213, 230, 0.14)',
  secondary: 'rgba(157, 144, 255, 0.16)',
  info: 'rgba(111, 168, 255, 0.14)',
  success: 'rgba(45, 212, 163, 0.14)',
  warning: 'rgba(245, 185, 75, 0.14)',
  danger: 'rgba(255, 100, 124, 0.16)',
} as const;

export const gradients = {
  /** Screen background: a soft navy glow at the top fading into the base colour. */
  screen: {
    colors: [palette.navyGlow, palette.navy950, palette.navy950],
    locations: [0, 0.42, 1],
  },
  /** Hero panels: cyan into violet at low opacity over the card colour. */
  hero: {
    colors: ['rgba(53, 213, 230, 0.20)', 'rgba(157, 144, 255, 0.14)', 'rgba(17, 30, 50, 0)'],
    locations: [0, 0.55, 1],
  },
  /** Brand mark and the primary floating action. */
  accent: { colors: [palette.cyan400, palette.violet400], locations: [0, 1] },
} as const;

/** Chart series colours, in order. Charts always label values; colour is never the only key. */
export const chartColors = [
  palette.cyan400,
  palette.violet400,
  palette.emerald400,
  palette.amber400,
  palette.blue400,
  palette.rose400,
] as const;

export type Tone = 'neutral' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textSecondary, bg: tints.neutral },
  primary: { fg: colors.primary, bg: tints.primary },
  secondary: { fg: colors.secondary, bg: tints.secondary },
  info: { fg: colors.info, bg: tints.info },
  success: { fg: colors.success, bg: tints.success },
  warning: { fg: colors.warning, bg: tints.warning },
  danger: { fg: colors.danger, bg: tints.danger },
};

/* ------------------------------------------------------------------ */
/* Typography                                                          */
/* ------------------------------------------------------------------ */

/**
 * System font (Roboto on Android, SF on iOS). Text scales with the OS font-size setting;
 * layouts must allow for wrapping rather than fixing heights around text.
 */
/** Figures that line up in columns (money, counts, times). */
const tabularNums: NonNullable<TextStyle['fontVariant']> = ['tabular-nums'];

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  bodySmall: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '400' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.4 },
  metric: { fontSize: 26, lineHeight: 32, fontWeight: '700', fontVariant: tabularNums },
  /** Money and other aligned figures. */
  figure: { fontSize: 15, lineHeight: 22, fontWeight: '600', fontVariant: tabularNums },
  figureLarge: { fontSize: 24, lineHeight: 30, fontWeight: '700', fontVariant: tabularNums },
} as const;

/* ------------------------------------------------------------------ */
/* Spacing, radius, layout                                             */
/* ------------------------------------------------------------------ */

/** 4-pt scale. */
export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;

/** Icon glyph sizes. */
export const iconSize = { xs: 14, sm: 16, md: 20, lg: 24, xl: 28 } as const;

/** Width breakpoints (dp). */
export const breakpoints = { compact: 360, medium: 600, expanded: 840 } as const;

export const layout = {
  /** Minimum touch target (Android 48dp; iOS asks for 44pt). */
  minTouchTarget: 48,
  /** Readable content column on tablets and large phones in landscape. */
  maxContentWidth: 720,
  /** Width at which screens switch to roomier padding and multi-column grids. */
  wideBreakpoint: 600,
  screenPadding: spacing.lg,
  screenPaddingWide: spacing.xxl,
  /** Square well behind a small glyph or index number. */
  iconWell: 36,
  /** Larger well used by empty and error states. */
  stateWell: 56,
  /** Smallest comfortable width for a metric card before the row wraps. */
  metricMinWidth: 96,
  /** Smallest quick-access tile width before the grid wraps (2-up on phones, 4-up on tablets). */
  tileMinWidth: 128,
  /** Comfortable line length for short supporting copy. */
  proseMaxWidth: 300,
  swatchSize: 72,
  dialogMaxWidth: 420,
  tabBarHeight: 64,
  /** Gap between the floating tab bar and the screen edges. */
  tabBarInset: 12,
  /** Space screens leave below their content for the floating tab bar. */
  tabBarClearance: 64 + 12 + 16,
  /** Bottom sheet maximum height as a share of the window. */
  sheetMaxHeight: 0.86,
  /** Height of a full-size bar in same-day charts. */
  chartBarHeight: 10,
  fabSize: 56,
} as const;

/* ------------------------------------------------------------------ */
/* Borders and elevation                                               */
/* ------------------------------------------------------------------ */

export const borders = {
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  focus: 2,
} as const;

/**
 * Depth via `boxShadow` (supported on Android and iOS with the New Architecture).
 * Kept subtle: on a dark UI, borders and surface steps carry most of the hierarchy.
 */
export const elevation = {
  none: {},
  low: { boxShadow: '0px 2px 10px rgba(1, 4, 12, 0.40)' },
  medium: { boxShadow: '0px 10px 28px rgba(1, 4, 12, 0.50)' },
  high: { boxShadow: '0px 18px 44px rgba(1, 4, 12, 0.60)' },
  /** Soft cyan ambient glow for the single primary action on a screen. */
  glow: { boxShadow: '0px 8px 24px rgba(53, 213, 230, 0.28)' },
} as const;

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/**
 * Durations in ms. Motion must explain a change, never decorate. Every animation
 * checks `useReducedMotion()` and falls back to an instant or static state.
 */
export const motion = {
  duration: { instant: 0, fast: 120, base: 200, slow: 320, pulse: 900 },
  pressedOpacity: 0.85,
  pressedScale: 0.98,
  skeleton: { minOpacity: 0.45, maxOpacity: 0.9 },
  /** Entrance offset for cards and list rows (dp). */
  enterOffset: 10,
  /** Per-item delay for staggered entrances, capped by `staggerMax`. */
  stagger: 40,
  staggerMax: 240,
  /** Bezier curves (x1, y1, x2, y2) for Reanimated `Easing.bezier`. */
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0, 0, 0, 1],
    accelerate: [0.3, 0, 1, 1],
  },
  /** Spring for the tab indicator and sheets: settles quickly, no visible bounce. */
  spring: { damping: 22, stiffness: 220, mass: 0.9 },
} as const;

/* ------------------------------------------------------------------ */
/* Glass                                                               */
/* ------------------------------------------------------------------ */

export const glass = {
  /** expo-blur intensity (1–100). */
  intensity: 28,
  tint: 'dark',
  /** Fill for the opaque glass fallback (Android, web, Reduce Transparency). */
  fallback: palette.navy900,
} as const;
