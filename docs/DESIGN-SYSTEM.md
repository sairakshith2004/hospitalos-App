# HospitalOS Mobile design system

## Visual direction
A modern clinical operations product with a midnight-navy foundation, controlled glass surfaces, cyan primary accent and violet secondary accent. The interface should be calm, legible and operationally focused, not a gaming or crypto look.

All values live in `apps/mobile/src/theme/tokens.ts`. Screens and components reference tokens; they never hard-code colours, sizes or timings.

## Colour

| Token | Value | Use | Contrast on background |
| --- | --- | --- | --- |
| `background` | #0B1220 | App background | — |
| `backgroundElevated` | #101B2E | Navigation surfaces, disabled inputs | — |
| `surfaceStrong` | #152238 | Cards, inputs, glass fallback | — |
| `surfaceRaised` | #1C2C47 | Raised or disabled filled controls | — |
| `surface` | #152238 at 72% | Glass fill over blur (iOS) | — |
| `primary` | #38BDF8 | Primary actions, links, focus | 8.7:1 |
| `secondary` | #A78BFA | Secondary accent | 6.9:1 |
| `text` | #F8FAFC | Primary text | 17.9:1 |
| `textSecondary` | #C1CDDC | Supporting text | 11.6:1 |
| `textMuted` | #94A3B8 | Captions, metadata, placeholders | 7.3:1 |
| `textDisabled` | #64748B | Disabled controls only (WCAG-exempt) | 3.9:1 |
| `success` | #34D399 | Positive status | 9.7:1 |
| `warning` | #FBBF24 | Needs attention | 11.2:1 |
| `danger` | #FB7185 | Errors, destructive actions | 7.0:1 |

Every text colour except `textDisabled` passes WCAG AA (4.5:1) on all four surface levels; the lowest is `secondary` on `surfaceRaised` at 5.1:1. Filled buttons use navy text on cyan (8.7:1). Status colours are always paired with a text label, never used as the only signal.

Tints (`tints.*`, 14% opacity) provide chip and icon-well backgrounds. `toneColors` maps each tone (`neutral`, `primary`, `secondary`, `success`, `warning`, `danger`) to a foreground and tint pair.

## Typography
System font (Roboto on Android, SF on iOS). Text scales with the OS font-size setting, so layouts wrap instead of fixing heights.

| Variant | Size/line height | Weight |
| --- | --- | --- |
| display | 29/34 | 700 |
| title | 24/30 | 700 |
| headline | 17/22 | 700 |
| body / bodyStrong | 15/22 | 400 / 600 |
| bodySmall | 13/19 | 400 |
| label | 13/18 | 600 |
| caption | 11/15 | 400 |
| overline | 11/14, tracking 1.4 | 700 |
| metric | 22/28 | 700 |

Use `<AppText variant color>` instead of raw `<Text>`.

## Spacing, radius and layout
- Spacing (4-pt): xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48.
- Radius: xs 8, sm 12 (buttons, inputs), md 18 (tiles, rows), lg 24 (cards), pill.
- Minimum touch target 48dp. Icon buttons may look 36px but keep a 48dp hit area.
- Content column max 720dp, centred on tablets. Side padding 16dp, or 32dp at 600dp and wider.
- Grids wrap with flex minimum widths (`metricMinWidth`, `tileMinWidth`) instead of measuring the screen.

## Borders and elevation
- Borders: hairline, 1px default, 2px focus. Colours: `border` (20% slate), `borderStrong` (36%), `borderFocus` (cyan).
- Elevation uses `boxShadow` (New Architecture, Android and iOS): `low`, `medium`, `high`. On a dark UI, surface steps and borders carry most of the hierarchy; keep shadows subtle.

## Glass
`GlassCard` uses real blur (expo-blur, intensity 24, dark tint) on iOS only. Android, web and iOS with Reduce Transparency get an opaque `SurfaceCard`. Android blur needs a `BlurTargetView` setup and costs performance on older devices, so the opaque version is the deliberate default. Use one or two glass panels per screen at most, for hero or summary content.

## Motion
- Durations: fast 120ms, base 200ms, slow 320ms, skeleton pulse 900ms.
- Press feedback: opacity 0.85 and scale 0.98.
- Use motion to show hierarchy and state changes, never as decoration.
- `useReducedMotion()` follows Android "Remove animations" and iOS "Reduce Motion". When it is on, screen transitions switch to none, skeletons stop pulsing and press scaling is turned off.
- 3D is reserved for onboarding or non-critical moments. Core clinical workflows never depend on 3D rendering.

## Components (`apps/mobile/src/components`)
| Component | Notes |
| --- | --- |
| `ScreenContainer` | Gradient background, safe-area insets (edge-to-edge), responsive padding, max-width column |
| `SectionHeader` | Heading role; optional meta text or action link |
| `GlassCard` / `SurfaceCard` | Glass with opaque fallback / opaque card; padding and elevation props |
| `PrimaryButton` / `SecondaryButton` / `DangerButton` | 48dp min; disabled and busy states exposed to screen readers |
| `IconButton` | Requires `accessibilityLabel`; 48dp hit area |
| `TextField` | Visible label, helper text, error announced with a polite live region |
| `SearchField` | Search role, clear button |
| `StatusChip` | Tone plus text; read as "Status: …" |
| `MetricCard` | KPI read as one unit |
| `ListRow` | Leading and trailing slots; becomes a button with a chevron when `onPress` is set |
| `Avatar` | Initials only (no personal photos in the prototype) |
| `EmptyState` / `ErrorState` | Optional action / retry; error detail shown in development only |
| `LoadingSkeleton` / `SkeletonBlock` | Busy progress indicator; static when reduced motion is on |
| `Icon` | Small dependency-free set: search, close, plus, chevron-right, check, alert, info |

Sheets and dialogs are not built yet. They will be added when the first workflow needs one.

The `/showcase` route renders every component and token with a width preview (device, 320, 390). It is unavailable in production builds.

## Layout principles
- Optimise for one-handed Android use.
- Use a small number of meaningful metrics; avoid dashboard clutter.
- Provide empty, loading, error and offline states for every data-driven screen.

## Prototype data
All dashboard and showcase values are synthetic placeholders and must never be read as live hospital data.
