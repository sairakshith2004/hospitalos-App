/**
 * HospitalOS Mobile design tokens.
 *
 * The single source of design values. Screens and components must reference these
 * tokens instead of hard-coding colours, sizes or timings. Full rationale and contrast
 * figures live in docs/DESIGN-SYSTEM.md.
 */
import { StyleSheet } from 'react-native';

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

/** Raw palette. Prefer the semantic `colors` below in components. */
export const palette = {
  navy950: '#0B1220',
  navyGlow: '#142B49',
  navy900: '#101B2E',
  navy850: '#152238',
  navy800: '#1C2C47',
  navy700: '#244568',
  navy600: '#4C789E',
  slate50: '#F8FAFC',
  slate300: '#C1CDDC',
  slate400: '#94A3B8',
  slate500: '#64748B',
  cyan400: '#38BDF8',
  violet400: '#A78BFA',
  emerald400: '#34D399',
  amber400: '#FBBF24',
  rose400: '#FB7185',
} as const;

/**
 * Semantic colours. Contrast on `background` (WCAG 2.x):
 * text 17.9:1, textSecondary 11.6:1, textMuted 7.3:1, primary 8.7:1, secondary 6.9:1,
 * success 9.7:1, warning 11.2:1, danger 7.0:1. All pass AA on every surface level.
 * `textDisabled` (3.9:1) is for disabled controls only, which WCAG exempts.
 */
export const colors = {
  background: palette.navy950,
  backgroundElevated: palette.navy900,
  /** Translucent glass fill used on top of blur (iOS). */
  surface: 'rgba(21, 34, 56, 0.72)',
  /** Opaque surface: cards, inputs, and the glass fallback. */
  surfaceStrong: palette.navy850,
  surfaceRaised: palette.navy800,
  surfacePressed: palette.navy700,
  border: 'rgba(148, 163, 184, 0.20)',
  borderStrong: 'rgba(148, 163, 184, 0.36)',
  borderFocus: palette.cyan400,
  text: palette.slate50,
  textSecondary: palette.slate300,
  textMuted: palette.slate400,
  textDisabled: palette.slate500,
  /** Text/icon colour on filled primary or danger buttons. */
  textOnAccent: palette.navy950,
  primary: palette.cyan400,
  secondary: palette.violet400,
  success: palette.emerald400,
  warning: palette.amber400,
  danger: palette.rose400,
  avatar: palette.navy700,
  avatarBorder: palette.navy600,
  skeleton: palette.navy800,
  scrim: 'rgba(11, 18, 32, 0.72)',
} as const;

/** Low-opacity fills for chips, icon wells and highlights. */
export const tints = {
  neutral: 'rgba(148, 163, 184, 0.14)',
  primary: 'rgba(56, 189, 248, 0.14)',
  secondary: 'rgba(167, 139, 250, 0.14)',
  success: 'rgba(52, 211, 153, 0.14)',
  warning: 'rgba(251, 191, 36, 0.14)',
  danger: 'rgba(251, 113, 133, 0.14)',
} as const;

export const gradients = {
  /** Screen background: a soft navy glow at the top fading into the base colour. */
  screen: {
    colors: [palette.navyGlow, palette.navy950, palette.navy950],
    locations: [0, 0.48, 1],
  },
} as const;

export type Tone = 'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.textSecondary, bg: tints.neutral },
  primary: { fg: colors.primary, bg: tints.primary },
  secondary: { fg: colors.secondary, bg: tints.secondary },
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
export const typography = {
  display: { fontSize: 29, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  bodySmall: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '400' },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 1.4 },
  metric: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
} as const;

/* ------------------------------------------------------------------ */
/* Spacing, radius, layout                                             */
/* ------------------------------------------------------------------ */

/** 4-pt scale. */
export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { xs: 8, sm: 12, md: 18, lg: 24, pill: 999 } as const;

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
  low: { boxShadow: '0px 2px 8px rgba(2, 6, 23, 0.35)' },
  medium: { boxShadow: '0px 8px 24px rgba(2, 6, 23, 0.45)' },
  high: { boxShadow: '0px 16px 40px rgba(2, 6, 23, 0.55)' },
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
} as const;

/* ------------------------------------------------------------------ */
/* Glass                                                               */
/* ------------------------------------------------------------------ */

export const glass = {
  /** expo-blur intensity (1–100). */
  intensity: 24,
  tint: 'dark',
} as const;
