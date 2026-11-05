# HospitalOS Mobile app

Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router · TypeScript (strict).
Design prototype only: synthetic data, no backend, no authentication.

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

## Component showcase

Open **Open component showcase** at the bottom of the dashboard, or go to `/showcase`. It is
hidden and redirects to the dashboard when `EXPO_PUBLIC_APP_ENV=production`.
