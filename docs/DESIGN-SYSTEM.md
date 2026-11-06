# HospitalOS Mobile design system

Premium dark clinical product: midnight-navy foundation, layered navy surfaces, clinical cyan
primary, soft violet secondary, restrained gradients and controlled glass. Calm and legible, never a
gaming or crypto look. Revised 2026-11-06 (premium UI redesign); the audit that led to it is
`docs/UI-VISUAL-GAP-REPORT.md`.

All values live in `apps/mobile/src/theme/tokens.ts`. Screens and components reference tokens; they
never hard-code colours, sizes or timings.

## Colour

Contrast is measured, not judged by eye: `src/theme/__tests__/contrast.test.ts` computes WCAG 2.x
ratios from the token values and fails the build if any text colour drops below 4.5:1 on any surface.

| Token | Value | Use | On background / card / raised |
| --- | --- | --- | --- |
| `background` | #080F1D | App background | — |
| `backgroundElevated` | #0D1728 | Inputs, segmented tracks | — |
| `surfaceStrong` | #111E32 | Cards, glass fallback | — |
| `surfaceRaised` | #192840 | Raised cards, secondary buttons, sheets, dialogs | — |
| `surfacePressed` | #1C2C46 | Pressed rows (kept dark enough for muted text) | — |
| `tabBar` | #0D1728 | Floating tab bar (opaque: nothing shows through) | — |
| `primary` | #35D5E6 | Primary actions, active tab, focus, links | 10.8 / 9.4 / 8.3 |
| `secondary` | #9D90FF | Secondary accent, diagnoses, module icons | 7.2 / 6.3 / 5.5 |
| `info` | #6FA8FF | Scheduled states | 8.0 / 7.0 / 6.2 |
| `text` | #F4F7FC | Primary text | 17.8 / 15.6 / 13.8 |
| `textSecondary` | #B6C3D4 | Supporting copy | 10.7 / 9.4 / 8.3 |
| `textMuted` | #8494AB | Metadata, captions, placeholders | 6.2 / 5.4 / 4.8 |
| `textDisabled` | #64748B | **Disabled controls only** (WCAG-exempt, 3.5–4.0:1) | — |
| `success` | #2DD4A3 | Done, paid, verified | 10.1 / 8.8 / 7.8 |
| `warning` | #F5B94B | Waiting, needs action, allergy | 10.9 / 9.5 / 8.4 |
| `danger` | #FF647C | Errors, cancelled, destructive | 6.7 / 5.9 / 5.2 |

Filled buttons put navy text on cyan (10.8:1) or rose (6.7:1). Borders: `border` (16 % slate),
`borderStrong` (32 %), `borderFocus` (cyan) and `borderHighlight` (7 % white top edge on glass).
`tints.*` are 14–16 % fills for chips and icon wells; every chip label passes 4.5:1 on its tint
(tested). Status colours always come with a text label.

**One status mapping.** `components/status.ts` `statusTone()` maps every workflow status once:
waiting/needs action → warning, under way → primary, done → success, scheduled → info, stopped →
danger, other → neutral. Screens never choose status colours themselves.

Gradients: `gradients.screen` (navy glow at the top), `gradients.hero` (cyan → violet at 14–20 %
for the one hero panel per screen), `gradients.accent` (brand mark, gradient avatar ring, FAB).
`chartColors` gives chart series in a fixed order.

## Typography

System font (Roboto on Android, SF on iOS); text scales with the OS setting, so layouts wrap.

| Variant | Size/line | Weight | Use |
| --- | --- | --- | --- |
| display | 28/34, −0.4 | 700 | Tab-screen titles, greeting |
| title | 22/28 | 700 | Stack-screen titles, identity headers |
| headline | 17/22 | 700 | Section headers, hero summaries |
| subhead | 15/20 | 700 | Card titles, chart titles |
| body / bodyStrong | 15/22 | 400 / 600 | Content |
| bodySmall | 13/19 | 400 | Supporting copy |
| label | 13/18 | 600 | Chips, field labels |
| caption | 11/15 | 400 | Metadata |
| overline | 11/14, +1.4 | 700 | Eyebrows ("RECEPTION", "TODAY · LIVE") |
| metric | 26/32, tabular | 700 | KPI values |
| figure / figureLarge | 15/22 · 24/30, tabular | 600 / 700 | Money and aligned figures |

## Spacing, radius, sizes, layout

- Spacing (4-pt): xxs 2, xs 4, sm 8, md 12, lg 16, xl 24, xxl 32, xxxl 48.
- Radius: xs 8, sm 12, md 16 (buttons, inputs), lg 22 (cards), xl 28 (sheets, dialogs), pill.
- Icon sizes: xs 14, sm 16, md 20, lg 24, xl 28.
- Breakpoints: compact 360, medium 600 (`isWide`), expanded 840. `useResponsiveLayout()` also
  returns `isCompact`.
- Touch targets 48 dp minimum; icon buttons may look 36–44 dp with a 48 dp hit area.
- Content column max 720 dp; side padding 16 dp, 32 dp from 600 dp.
- Tab screens leave `layout.tabBarClearance` below their content for the floating tab bar.
- Grids wrap with flex bases; KPI cards are 2-up on phones and 4-up on tablets; money KPIs take a
  full row on phones so no paisa is truncated.

## Elevation, glass and surfaces

- `elevation.low / medium / high` (`boxShadow`, New Architecture) plus `elevation.glow`, a soft cyan
  glow reserved for the one primary action on a screen.
- Cards: `SurfaceCard` (variants `default`, `raised`, `outline`; padded cards space their children
  automatically; unpadded cards hold divided lists).
- `GlassCard`: real blur (expo-blur, intensity 28) on iOS only. Android, web and iOS with Reduce
  Transparency get an opaque surface with the same edge highlight; `tone="hero"` adds the low-opacity
  accent gradient. No blur cost on mid-range Android phones. One hero panel per screen.

## Motion

- Durations: fast 120, base 200, slow 320 ms; easing curves `standard`, `decelerate`, `accelerate`;
  one spring (`damping 22, stiffness 220`) that settles without visible bounce.
- `useEntrance(index)`: fade-and-rise of 10 dp on mount, staggered 40 ms per item, capped at
  240 ms. Opacity and transform only, never layout, so nothing shifts.
- `PressableScale`: spring scale (0.98) and opacity on press, on the UI thread (Reanimated 4).
- Tab bar: the active pill springs between tabs. Bottom sheets slide up; dialogs fade and zoom.
- Charts: bars grow inside fixed tracks (width only).
- Reduced motion (`useReducedMotion()`, Android "Remove animations", iOS "Reduce Motion") turns off
  scale, entrances, sheet slides, tab springs and chart growth; skeletons stop pulsing.
- No looping decoration. No 3D in clinical or billing workflows. No haptics (`expo-haptics` is not
  installed and was not added).

## Components (`apps/mobile/src/components`)

| Requested name | Implementation | Notes |
| --- | --- | --- |
| AppScreen | `ScreenContainer` (alias `AppScreen`) | Gradient + violet ambient light, safe areas, tab-bar clearance |
| GlassCard | `GlassCard` | `tone="hero"`, `enterIndex` |
| GradientHeader | `GradientHeader` | Eyebrow, display title, trailing actions (tab screens) |
| SectionHeader | `SectionHeader` | Optional meta, action link, count pill |
| MetricCard | `MetricCard` | Icon well, tabular value, optional real `share` bar |
| PatientCard | `PatientCard` | Initials, name, MRN badge, allergy chip; `row`/`header`, `flush` |
| AppointmentCard | `AppointmentCard` | Time + token column, patient, doctor, status, actions |
| DoctorCard | `DoctorCard` | Radio semantics, selected state, fee |
| StatusBadge | `StatusChip` (alias `StatusBadge`) + `statusTone()` | Read as "Status: …" |
| SearchBar | `SearchField` (alias `SearchBar`) | Cyan focus, clear button |
| PrimaryButton / SecondaryButton | `Button.tsx` | Also `DangerButton`, `GhostButton`, `size="lg"`, `ActionRow` |
| IconButton | `IconButton` | Optional badge dot |
| FormField | `TextField` (alias `FormField`) | Visible label, helper/error, `revealable` password toggle |
| BottomNavigation / CustomTabBar | `CustomTabBar` (alias `BottomNavigation`) | Floating, opaque, spring pill, hides with the Android keyboard |
| BottomSheet | `BottomSheet` | Scrim, close button and Android back close it |
| ConfirmationDialog | `ConfirmDialog` (alias `ConfirmationDialog`) | Transparent-modal route |
| EmptyState / ErrorState | `EmptyState`, `ErrorState` | Error variants `error`, `offline`, `forbidden` |
| LoadingSkeleton | `LoadingSkeleton` | `list` and `tiles` shapes |
| ChartCard | `ChartCard` + `BarList`, `StackedBar` | Honest caption (source, period); DEMO DATA label when synthetic |
| Avatar | `Avatar` | Initials only; `ring` for the signed-in person |
| FloatingActionButton | `FloatingActionButton` | Render only with the permission for its action |
| ProfileHeader | `ProfileHeader` | Hero identity on Profile |

Also: `ChoiceChip`, `ChoiceGroup`, `SegmentedControl` (selection), `DataRow` (label + right-aligned
tabular value, total emphasis, removed lines struck through), `Divided` (hairline dividers between
rows), `BrandMark` (token-drawn product mark, no real organisation's logo), `Banner`, `ListRow`,
`ScreenHeader` (stack screens, eyebrow), `QueryBoundary` (loading → offline → forbidden → error →
data).

## Rules

- **Selection** uses chips, segments or cards with a selected state that screen readers announce.
  Never a disabled button for the chosen option, never a "✓" text prefix.
- **Money** is integer paise formatted by `formatPaise`, shown in `DataRow` or full-width KPI cards
  with tabular figures; totals are emphasised; removed charges are struck through, never hidden.
- **Charts** show same-day composition (parts of a real whole, e.g. today's appointments by state) or
  ordered pipelines, and only when every figure they need was returned and at least one is non-zero.
  No trend or historical chart until a time-series API exists.
- **Clinical screens**: allergies sit beside the patient identity; vitals are tiles with units; lab
  flags are the server's factual low/normal/high; ordering a test asks for confirmation; no decorative
  motion near clinical actions; no recommendations.
- **States**: every data view has loading (shaped skeleton), empty (what is missing and the next
  step), offline, permission-denied and error with retry.
- **Every visible button works**; quick actions and module tiles appear only for permitted roles.

## Data honesty

Home figures come only from `GET /api/v1/dashboard`; each role's layout (hero summary, chart choice,
quick actions) is configured in `features/dashboard/role-home.ts`, which builds text only from
returned figures. Synthetic figures appear only in the development demo session and always carry
DEMO DATA. The `/showcase` route renders components and tokens and is unavailable in production.
