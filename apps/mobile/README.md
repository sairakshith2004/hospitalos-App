# HospitalOS Mobile app

Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router · TypeScript (strict).
Phase 1.0 (mobile foundation alignment): no backend, no real sign-in and no live data yet. Plans:
[`docs/MOBILE-IMPLEMENTATION-ROADMAP.md`](../../docs/MOBILE-IMPLEMENTATION-ROADMAP.md).

## Requirements

- Node.js 22.13 or newer (tested with Node 24.20 / npm 11.19)
- Android: Android Studio with an emulator, **or** an Android phone with Expo Go (SDK 57)
- iOS (later): macOS with Xcode, or an iPhone with Expo Go

## Setup

```bash
cd apps/mobile
npm install
cp .env.example .env      # required; the app refuses to start without it
npm start
```

Then press `a` for the Android emulator, or scan the QR code with Expo Go on your phone.

## Scripts

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm start`         | Start the Metro dev server                         |
| `npm run android`   | Start and open on a running Android emulator       |
| `npm run ios`       | Start and open in the iOS simulator (macOS only)   |
| `npm run lint`      | ESLint (`eslint-config-expo` + project rules)      |
| `npm run format`    | Prettier, write changes (`format:check` to verify) |
| `npm run typecheck` | `tsc --noEmit`                                     |
| `npm test`          | Jest (`jest-expo` + React Native Testing Library)  |
| `npm run doctor`    | `expo-doctor` dependency and config checks         |
| `npm run check`     | typecheck, lint, format check and tests together   |

## Running on Android

**Emulator:** install Android Studio, create a device in Device Manager (Pixel, recent API
level), start it, then run `npm run android`. Make sure `adb` is on your `PATH`
(`$HOME/Library/Android/sdk/platform-tools` on macOS).

**Physical device:** install Expo Go from the Play Store, put the phone on the same Wi-Fi as
your computer, run `npm start` and scan the QR code. If the networks are isolated, use
`npx expo start --tunnel`.

## Configuration

`src/config/env.ts` reads and validates environment variables when the app starts and throws
a clear error if one is missing or invalid. Restart with `npx expo start --clear` after
editing `.env`.

| Variable              | Values                                 |
| --------------------- | -------------------------------------- |
| `EXPO_PUBLIC_APP_ENV` | `development`, `staging`, `production` |

`EXPO_PUBLIC_*` values are compiled into the app and readable by anyone. Never put secrets,
API keys or patient data in `.env`. Only `.env.example` is committed.

## App identity (provisional)

| Setting          | Value                   |
| ---------------- | ----------------------- |
| Display name     | `HospitalOS`            |
| Android package  | `com.hospitalos.mobile` |
| iOS bundle ID    | `com.hospitalos.mobile` |
| Deep-link scheme | `hospitalos`            |

These are placeholders. Replace them with a reverse-domain ID your organisation owns before the
first Play Store or App Store upload; the Android package cannot change after publishing.
Icons and splash images are still the Expo template defaults.

## Structure

```text
src/
  app/          Expo Router routes only (thin files that render feature screens)
  components/   Design system components (see docs/DESIGN-SYSTEM.md)
  config/       Typed, validated environment config
  features/     Feature screens and their local data/helpers
  hooks/        Shared hooks (reduced motion, responsive layout)
  services/     API clients later; empty for now
  theme/        Design tokens: the only place design values live
  types/        Shared types
assets/         App icons and splash image
```

Imports use the `@/` alias for `src/` (configured in `tsconfig.json`; Metro reads it natively).

## Access model

- `src/features/access/permissions.ts`: the 88 permission codes of the reference HospitalOS model.
- `src/features/access/roles.ts` and `role-permissions.ts`: the 11 roles, their reference codes
  (SA, ADM, REC, DOC, NUR, PHA, LAB, FIN, HR, INV, MKT) and each role's grants.
- `src/features/access/modules.ts`: which Home modules each user **sees** (display only).

Tests compare the codes and grants with the grid in
[`docs/MOBILE-ROLE-MODULE-MATRIX.md`](../../docs/MOBILE-ROLE-MODULE-MATRIX.md), so a change to one
without the other fails. Permissions decide only what the app shows; the API (from phase 1.1)
authorizes every request.

## Navigation

Five tabs for every role: Home, Work Queue, Search, **Inbox** and Profile. Inbox shows a labelled
"arrives in Release 7" state only, with no counts, badges or sample items. Hospital modules open
from Home; each one says which release its screens arrive in.

## Dashboard demo data

For design and visual testing, a **development demo session** sees synthetic, outpatient-only
figures and tasks for its role (`src/features/dev/demo-dashboard.ts`), every block labelled
**DEMO DATA**. They are aggregate numbers and generic task titles only, never patient,
appointment, clinical or financial records, and never workflow data.

- `src/features/dashboard/dashboard-content.ts` decides what Home shows: demo content only for a
  demo session in a development build; otherwise an honest "No live figures yet" / "No tasks yet"
  state until the API serves real figures (phase 1.11).
- Production builds (`EXPO_PUBLIC_APP_ENV=production`) never show demo figures.
- ESLint (`no-restricted-imports`) blocks `demo-data`, `fixtures` and `sample-data` imports outside
  `src/features/dev` and `src/features/showcase`, and lets only `dashboard-content.ts` import the
  demo dashboard.

## Development tools (development builds only)

On the sign-in screen, **Open demo workspace** starts a local preview session, and Profile →
Developer tools → **Role preview** switches between the 11 roles. The preview session has no
credential and the app makes no network requests, so it can't authorize anything; it is removed
in phase 1.2, when development builds sign in to seeded demo accounts through the API.
**Component showcase** (`/showcase`) is in the same menu. With `EXPO_PUBLIC_APP_ENV=production`
the demo button, role preview and showcase don't exist (tested in
`src/__tests__/production-guards.test.tsx`).

## Testing notes

- Jest runs on the default `jest-expo` preset (iOS). The `jest-expo/android` preset doesn't load
  in Expo SDK 57, so Android behaviour must be checked on an emulator or a phone.
- Tab bar items have the accessibility role `tab` on Android and `button` on iOS (React
  Navigation); tests query the platform's role.

## Android verification status

No Android emulator or physical-device check has been run for this project yet: there is no
Android SDK on the development Mac. Every result so far comes from Jest on macOS. The pending
checklist is in the roadmap §3.1 (Phase 1.0, "Android verification").
