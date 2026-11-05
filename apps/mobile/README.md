# Mobile app source

This folder contains the design-first Expo Router screens and shared UI primitives.
The workspace is intentionally bootstrapped with the current Expo SDK locally so that
Expo's generated native configuration and dependency versions remain aligned.

## Bootstrap from repository root

```bash
npx create-expo-app@latest apps/mobile
```

When prompted, select the Expo Router TypeScript template. Then merge this folder's
`app/` and `src/` directories into the generated `apps/mobile/` directory.

Install required dependencies:

```bash
cd apps/mobile
npx expo install expo-blur expo-linear-gradient expo-status-bar
```

Start the app:

```bash
npx expo start
```

Press `a` for an Android emulator or scan the QR code with Expo Go on an Android device.
The current dashboard uses synthetic demo data only.
