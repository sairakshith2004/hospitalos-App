# HospitalOS Mobile: Stage A visual gap report

Date: 2026-11-06. Branch `release/r1-outpatient-operations` (working tree). Evidence: Expo **web
preview** screenshots at 360 × 800 (Chromium, signed in as each demo role against the development
API), plus a reading of every file in `apps/mobile/src/components`, `src/theme/tokens.ts` and the
screens under `src/features`. **No Android screenshots exist** (no Android SDK on the development Mac).

## 1. What is already sound

- One token file (`tokens.ts`) and a component library; screens almost never hard-code colours or
  sizes (only `app/+not-found.tsx` does).
- Accessibility basics: 48 dp targets, labelled inputs, polite error live regions, status chips with
  text (never colour only), reduced-motion and reduce-transparency hooks.
- Honest data: Home reads `GET /api/v1/dashboard`; demo figures are labelled DEMO DATA; loading and
  error states come from one `QueryBoundary`.

## 2. Design tokens

| Gap | Detail |
|---|---|
| Palette is generic Tailwind slate/sky | `#0B1220` background, `#38BDF8` sky cyan, `#A78BFA` violet. Not the approved midnight-navy direction (`#080F1D`, `#35D5E6`, `#9D90FF`) |
| Surfaces too close together | `surfaceStrong #152238` and `surfaceRaised #1C2C47` against `#0B1220` give little layering; cards read as flat slabs |
| Missing token groups | No icon sizes, motion curves, glass surface variants, accent gradients, chart colours, breakpoints beyond one width, or a tab-bar inset. Several components invent sizes (`18`, `24`, `36`, `6`) inline |
| Elevation unused for hierarchy | Every card uses the same border, radius 24 and shadow, so heroes, lists and forms look identical |

## 3. Colour inconsistencies

- Invoice status chip is always `primary` (blue), even for **Paid**; the queue screens map the same
  statuses to success/warning. Status colours are decided per screen (`statusTone` lives inside
  `RoleQueues.tsx`) instead of once.
- Visit history chips are always `neutral`, so Booked and Completed look the same.
- Danger is used for the Sign-out icon but not for destructive confirmations elsewhere.

## 4. Typography

- Home hero uses `display` (29/34) for a slogan ("Your hospital, in one view."), consuming about
  40 % of the first screen on a 360 dp phone with no information.
- Screen titles use `title` (24) on every screen, including inside stack headers next to a 48 dp back
  button; titles and headers compete.
- Metadata strings are concatenated with "·" and wrap mid-value (MRN, age, sex and phone on two
  lines; doctor names split across lines).
- Monetary values are not tabular and not right-aligned as a column; invoice totals have no
  hierarchy (total and paid share one body line).
- Vitals are one sentence ("37.4 °C · pulse 84 · BP 122/78 · SpO₂ 98%"), not readable as values.

## 5. Cards and surfaces

- `SurfaceCard` has no internal gap, so headings, chips, text and buttons touch (patient card,
  invoice summary, payment form).
- Lists inside cards have no dividers in several screens (patient visits, invoice lines, receipts,
  search results), so rows run together.
- Glass is never visible on Android or web (opaque fallback by design), so the "glass" look depends on
  a gradient that barely shows.
- Disabled filled buttons render as dark empty tiles (Record allergy), easy to mistake for a card.

## 6. Spacing and layout

- Buttons size to content and left-align (`alignSelf: flex-start`), so action rows are ragged
  (Register patient wider than Find patient; Book appointment and Walk-in mismatched).
- Selections use a disabled `SecondaryButton` for the chosen option (sex on Register, day on Book,
  invoice status filter, payment method). The selected option looks *unavailable*, and its state is
  not announced as selected.
- Book marks the chosen doctor and slot with a "✓ " text prefix instead of a selected state.
- Content is not padded above the tab bar consistently.

## 7. Navigation

- Default React Navigation tab bar: flat strip, no active indicator beyond tint.
- At 360 dp the label "Work Queue" truncates to "Work Qu…" and labels are clipped by the bottom edge
  (KI-22).
- Stack headers are custom (`ScreenHeader`) but large and inconsistent with tab-screen titles.

## 8. Loading, empty, error and offline states

- Loading: skeleton rows exist and are consistent.
- Empty: present on most lists, but Patient visits and Book slots use bare text ("No visits yet.",
  "No free slots that day.") instead of the empty state.
- Error: `ErrorState` is consistent; mutation failures show a `Banner`.
- Offline: an `offline` icon exists, but there is no offline-specific state; network errors surface as
  "Could not load" with the API's description.
- Permission denied: Search for roles without patient access shows a neutral empty state; module pages
  show "Not available for your role" (good).

## 9. Icons

- Ionicons outline set through one `Icon` vocabulary (good), but metric cards and dashboard tasks have
  no icons, while module tiles do; icon well sizes vary (36, 56).
- Sign-out and Settings share the settings glyph for Change password.

## 10. Animation

- Only press opacity/scale on buttons and a skeleton pulse. No entrance, tab or sheet transitions.
  Reanimated 4 is installed but unused. Reduced-motion support exists where motion exists.
- No haptics (`expo-haptics` is not installed; not added, to avoid a new dependency).

## 11. Screen-specific problems

| Screen | Problem |
|---|---|
| Sign in | Plain title and fields; no brand mark; "Open demo workspace" competes with Sign in |
| Home (all roles) | Slogan hero, no hospital identity, no inbox entry, metrics without icons or context, no same-day visual summary, quick actions absent (modules are the only actions) |
| Home per role | Layout identical for all 11 roles; only the numbers differ. MKT shows an empty figures card; INV shares pharmacy figures without stock emphasis |
| Work Queue | Reception rows put actions under the row with no card separation; status filter for invoices uses disabled buttons |
| Search | Results are text rows without avatar or MRN emphasis |
| Patient | No identity header (avatar, MRN badge); meta wraps; actions ragged; visits have no timeline feel or status colour |
| Book | Doctor selection by "✓ " prefix; day and slot pickers are ragged button walls; no summary of the choice |
| Register | Sex picker uses disabled buttons |
| Chart | Allergies not flagged near the patient identity; vitals as a sentence; disabled button looks like a tile |
| Consultation | Long single column of forms with equal weight; prescription lines not structured |
| Pharmacy / Dispense | Medicine, batch and expiry information as text rows; stock states not visually distinct |
| Laboratory | Worklist rows lack urgency emphasis; results entry is a plain list |
| Invoice | No money hierarchy; status always blue; collectable/outstanding not shown as figures; receipts cannot be opened |
| Inbox | Chip, empty state and banner stacked with equal weight |
| Profile | Identity card plain; account rows share icons |

## 12. Data constraints for the redesign

- `GET /api/v1/dashboard` returns **same-day** metrics and task counts per role. There is **no
  time-series endpoint**, so trend lines ("appointments over time", revenue charts) cannot be drawn
  without inventing data. The redesign uses KPI cards and same-day composition charts only; trends
  wait for an approved API addition.
- No hospital logo asset exists; the brand mark is drawn with tokens (no image of a real organisation).

## 13. Resolution (premium UI redesign, 2026-11-06)

| Section | Status |
|---|---|
| 2 Tokens | Resolved: approved palette, layered surfaces, all missing token groups added; contrast tested |
| 3 Colour | Resolved: one `statusTone()` mapping; invoice and visit statuses now coloured by meaning |
| 4 Typography | Resolved: slogan hero removed; display/title split; tabular money and figures; vitals as tiles |
| 5 Cards | Resolved: padded cards space children; divided lists; hero/default/raised/outline variants; disabled buttons dimmed |
| 6 Spacing | Resolved: `ActionRow` equal-width actions; selection chips with announced state; no "✓" prefixes |
| 7 Navigation | Resolved: floating custom tab bar with spring indicator; no truncation at 360 dp; eyebrows on stack headers |
| 8 States | Resolved: shaped skeletons, empty states with next steps, offline and permission-denied variants |
| 9 Icons | Resolved: icons on every KPI, task, action and module; distinct glyphs (key, receipt, barcode…) |
| 10 Animation | Resolved: restrained Reanimated motion, reduced-motion aware |
| 11 Screens | Resolved for every screen listed (see build log) |

## 14. Remaining gaps

1. **No Android verification** of the redesign (no SDK or phone on this Mac): blur, springs,
   TalkBack, keyboard and 200 % font scale are unverified on a device (KI-25, KI-1).
2. **No trend charts**: the API has no time-series endpoint; charts are same-day only by design.
3. **No haptics**: `expo-haptics` is not installed and was not added (dependency approval needed).
4. **Invoice discounts and tax** are not shown: the API has no such fields in R1.
5. **No hospital logo asset**: the brand mark is drawn from tokens.
6. **Web preview shows no blur** (opaque fallback), so glass looks flatter than on iOS.
7. Long names truncate after two lines in cards; the hospital name truncates in the Home header at
   360 dp (full name on wider screens).
8. Tests still print React "not wrapped in act(…)" warnings (KI-15).
9. The component showcase (`/showcase`, development only) was not redesigned beyond the shared
   components it renders.
