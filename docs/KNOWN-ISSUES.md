# Known issues

Open problems, with how and when each is resolved. Closed items move to the build log.

| # | Issue | Impact | Resolution |
|---|---|---|---|
| KI-1 | No Android emulator or physical-device check has ever been run (no Android SDK on the development Mac). All results so far come from Jest on macOS | Android-only behaviour (tab roles, back button, TalkBack, keyboard, SecureStore) is unverified | Install Android Studio; run the Phase 1.0 checklist (roadmap §3.1) before R1 sign-off |
| KI-2 | `jest-expo/android` preset fails to load in Expo SDK 57 | Mobile Jest runs on the default (iOS) preset only | Platform mocking in tests; Android proven on emulator; re-check at each Expo update |
| KI-3 | A stray `package.json`, `package-lock.json` and `node_modules` (`@types/react`, `csstype`) exist in the folder **above** the repository (`hospitalos-App-main/`) | Node and TypeScript search parent folders, so they could mask a missing dependency | The API and packages set `types: ["node"]` explicitly; CI builds from a clean checkout. The owner may delete the stray files (outside the repository) |
| KI-4 | Starting Docker Desktop also restarts the reference project's containers (`restart: unless-stopped` in its Compose file) | Reference containers run alongside ours; no collision (different names and ports) | Not changed: modifying the reference project's resources is out of bounds. Ours never auto-restart |
| KI-5 | A cached `postgres:17-bookworm` image was pulled during the phase 1.1 audit by a throwaway `docker run --rm` (no container, volume or network left behind) | Disk space only | `docker rmi postgres:17-bookworm` if wanted; our Compose file pins `postgres:17.11-bookworm` by digest |
| KI-6 | ~~The app kept its own copy of the 88 permissions~~ **Resolved 2026-11-06 (R1 phase 1.2):** `apps/mobile/src/features/access/permissions.ts` and `role-permissions.ts` re-export `@hospitalos/contracts`; a contracts test fails if a literal copy returns | — | Closed |
| KI-7 | Local `main` is behind `origin/main` (Phase 1.0 was merged on GitHub) | None for the phase branches, which start from `origin/main` | Fast-forward local `main` when the owner wants |
| KI-8 | `docs/ROADMAP.md` and `docs/IMPLEMENTATION-PLAN.md` are older plans | Could confuse readers | Mark superseded when the owner says so |
| KI-9 | Expo Doctor (online check, 2026-11-05) now reports 4 patch updates published since Phase 1.0: `expo` 57.0.31 → ~57.0.32, `expo-constants` 57.0.22 → ~57.0.23, `expo-router` 57.0.29 → ~57.0.30, `expo-splash-screen` 57.0.10 → ~57.0.11. Phase 1.0 passed 21/21 before these releases; nothing in phase 1.1 changed the app | Doctor shows 20/21 until upgraded | Upgrade with `npx expo install --check` as a separately approved mobile dependency change (not part of phase 1.1, which must not modify the app) |
| KI-10 | `npm audit` (root workspace, 2026-11-05): **0 critical, 0 high, 13 moderate**, all in development tools: (a) `esbuild <=0.24.2` (GHSA-67mh-4wv8-2f99, dev-server request exposure) inside `drizzle-kit`'s `@esbuild-kit/*` loader; (b) `minimatch 7.0.0–11.0.0` (GHSA-g3hv-75wg-m249, pattern denial of service) inside `eslint` and `typescript-eslint`. Neither package runs in production or serves network requests | Development machines only | Not fixed: the only offered fix is `npm audit fix --force`, which would downgrade `drizzle-kit` to 0.18.1 and `eslint` to 9.x (breaking). Re-check when fixed releases exist; CI gate is `--audit-level=high` |
| KI-11 | npm 11 blocked the install scripts of `esbuild` (0.18.20, 0.25.12, 0.28.2) and `fsevents` 2.3.3 (not yet approved with `npm install-scripts approve`) | None found: `tsx` runs and all API tests pass without them | Leave blocked. Approve only if a tool is shown to need them, as a separate approval |
| KI-12 | `npm audit` in `apps/mobile` (2026-11-05): **0 critical, 5 high**, 14 moderate, 9 low. The 5 high packages come from 2 high advisories; full classification below the table | One production path (crafted `hospitalos://` link can hang link parsing on the device: denial of service, no data exposure); one development-only path | CI blocks on any new unclassified high/critical (`npm run mobile:audit`). Remediation below; nothing changed in the app in phase 1.1 |
| KI-13 | `postgres:17.11-bookworm` (digest `665dc7b3…`) is now cached locally, alongside the images from KI-5 and the reference project | Disk space only (about 645 MB) | Needed while the local database runs |
| KI-14 | ~~CI had not run~~ **Updated 2026-11-06 (R1.13):** CI has run. Phase 1.1 passed; the R1 commit `fad45d5` and the `main` merge `fc96e03` **failed** in the mobile job (typed-route `@ts-expect-error` lines, see build log) | `main` on GitHub carries a red CI run until the fix is pushed | Fixed locally (uncommitted); confirm the next CI run after the owner approves the commit and push |

### KI-12 classification (mobile high-severity findings, 2026-11-05)

| Package (installed) | Path | Advisory | Scope | Expo-compatible fix | Safe remediation |
|---|---|---|---|---|---|
| `decode-uri-component` 0.2.2 | `expo-router` → `query-string` 7.1.3 → `decode-uri-component` | GHSA-qr28-fpjm-wq7f (high, ≤0.5.0); also GHSA-vcc3-ghjq-m6fr (moderate) | **Production**: Expo Router parses query strings of incoming links (`getStateFromPath`) | None in SDK 57: latest `expo-router` 57.0.30 still needs `query-string` ^7.1.3. Fixed `decode-uri-component` 0.5.1 is ESM-only; an npm override was tested in a scratch copy and **breaks** parsing (`decodeComponent is not a function`, 5 Jest suites fail) | Fix with the Expo SDK 58 upgrade (`expo-router` 58). Interim, needs app-change approval: an Expo Router `+native-intent` handler that rejects over-long or heavily percent-encoded incoming links before parsing |
| `query-string` 7.1.3 | `expo-router` → `query-string` | via GHSA-qr28-fpjm-wq7f | Production (same path) | As above | As above |
| `expo-router` 57.0.29 | direct dependency | via `query-string` | Production (same path) | As above | As above |
| `zod` 3.25.76 | `expo` → `@expo/cli`; `eslint-config-expo` → `eslint-plugin-react-hooks` | GHSA-mrhx-c7xc-m3w5 (high, <4.6.6; no fixed 3.x) | **Development only** (CLI and lint tooling; the app does not import `zod`) | Partly: the Expo patch upgrade (KI-9) moves to `@expo/cli` 57.0.33 and removes the CLI path; the ESLint plugin path remains | Approve the KI-9 patch upgrade. The remaining lint path only validates lint configuration on developer machines and CI |
| `@expo/cli` 57.0.32 | `expo` 57.0.31 → `@expo/cli` | via `zod` (high) and `glob` GHSA-3g3m-2fjr-6pw4 (moderate) | **Development only** (runs the dev server and builds) | **Yes**: `expo` ~57.0.32 brings `@expo/cli` 57.0.33 | Approve the KI-9 patch upgrade |

Patch-upgrade test (scratch copy, `npx expo install --fix`, real app untouched): changes `expo` ~57.0.32,
`expo-router` ~57.0.30, `expo-splash-screen` ~57.0.11; typecheck, ESLint and Jest 94/94 pass; Expo Doctor
21/21; `expo export --platform android` bundles 1,326 modules; audit goes from 5 high to 4 (`@expo/cli`
cleared). Caveat: `expo` 57.0.32 was published on 2026-11-05, so it is newer than the two-week rule.

**KI-12 update (2026-11-06).**

- Exploitability measured with the installed `query-string` 7.1.3 / `decode-uri-component` 0.2.2 on
  this Mac (`q=` followed by repeated `%C2`): 302 characters 68 ms, 602 characters 305 ms,
  1,202 characters 1.3 s, 2,102 characters 4.6 s, 3,002 characters 9.5–10.2 s. Time grows with the
  square of the length, on the JavaScript thread, so one crafted `hospitalos://` link can freeze the
  app. Phones will be slower.
- Interim mitigation (needs approval: it is an app change): an Expo Router `+native-intent` handler
  whose `redirectSystemPath` sends any incoming link longer than 2,048 characters, or one that the
  built-in `decodeURIComponent` rejects, to `/`. `decode-uri-component` only takes its slow path
  when the built-in decoder fails, so this blocks every measured payload in about 0.01 ms, while
  normal links (`/patients?q=Ravi%20Kumar`, `/search?q=%E2%82%B9500`) still work. It does not cover
  the web build (no native intents), which is not a release target.
- Development `zod` path: `eslint-plugin-react-hooks` 7.1.1 and `zod-validation-error` 4.0.2 accept
  `^3.25.0 || ^4.0.0`, and `@expo/cli` 57.0.33 (from the Expo patch) no longer depends on `zod`.
  Scratch test of the Expo patch plus the override `"eslint-plugin-react-hooks": { "zod": "4.6.7" }`:
  typecheck, ESLint (the hooks rule still reports a conditional `useState`), Jest 94/94, Expo Doctor
  21/21 and the Android export pass; audit goes from 5 high to 3 (only the `decode-uri-component`
  chain is left).

**KI-9 / KI-12 owner decision (2026-11-06): deferred to 2026-11-19 under the package-age policy.**

The Expo patch and the `zod` override are not applied before 2026-11-19, when `expo` 57.0.32
(published 2026-11-05) reaches two weeks. Not bypassed. An urgent issue before then needs a separate
remediation proposal and owner approval.

| Package | Installed | Proposed | Advisory | Path | Exposure until applied |
|---|---|---|---|---|---|
| `expo` | 57.0.31 | ~57.0.32 | (carrier for `@expo/cli`) | direct | — |
| `@expo/cli` | 57.0.32 | 57.0.33 (through `expo` ~57.0.32) | via `zod` GHSA-mrhx-c7xc-m3w5 (high), `glob` GHSA-3g3m-2fjr-6pw4 (moderate) | `expo` → `@expo/cli` | Developer machines and CI only: the dev server and build tools. Not in the app |
| `expo-router` | 57.0.29 | ~57.0.30 | does not fix GHSA-qr28-fpjm-wq7f | direct | See the production row below |
| `expo-splash-screen` | 57.0.10 | ~57.0.11 | none (Expo Doctor alignment) | direct | — |
| `zod` | 3.25.76 | 4.6.7 (override for `eslint-plugin-react-hooks` only) | GHSA-mrhx-c7xc-m3w5 (high) | `eslint-config-expo` → `eslint-plugin-react-hooks` (+ `zod-validation-error`) | Lint runs on developer machines and CI only; it validates lint configuration, not user input |
| `decode-uri-component` / `query-string` | 0.2.2 / 7.1.3 | none in SDK 57 | GHSA-qr28-fpjm-wq7f (high) | `expo-router` → `query-string` → `decode-uri-component` | **Production**: a crafted incoming link can freeze the app. Not fixed by the patch. Covered by the link guard (AD-M-017), first task of phase 1.2; fully fixed by Expo SDK 58 |

After 2026-11-19 (as a separately approved change): `npx expo install --fix` in `apps/mobile`, add
`"overrides": { "eslint-plugin-react-hooks": { "zod": "4.6.7" } }`, format `package.json`, then rerun
the full mobile checks, Expo Doctor and the Android export; remove the `zod` entry from
`scripts/mobile-audit-exceptions.json` once the audit no longer reports it.

**KI-12 mitigation (2026-11-06, phase 1.2, uncommitted).** The incoming-link guard (AD-M-017) now
checks every incoming link before Expo Router parses it. Links with malformed percent-encoding or
over 2,048 characters are refused, and query strings are dropped, so the vulnerable parser never
sees link input. Status: production finding **mitigated, not fixed**. The vulnerable packages stay
installed until Expo SDK 58, and in-app navigation built from the app's own values still uses
`query-string`. The audit exception keeps its review date (2026-12-31).

| # | Issue | Impact | Resolution |
|---|---|---|---|
| KI-15 | Mobile tests print React "not wrapped in act(…)" warnings from asynchronous form updates | Noise only; every test passes | Wrap the async submissions in `act` in the tests when touching them next |
| KI-16 | No real (non-demo) Super Admin exists in `hospitalos_dev`: `npm run api:bootstrap-admin -- dev` is interactive and was not run by the agent. The 11 demo accounts (including `demo-sa`) exist and were rotated in R1.13 | Development sign-in works with the demo accounts only | Owner runs the bootstrap when a named development administrator is wanted |

| # | Issue | Impact | Resolution |
|---|---|---|---|
| KI-17 | OpenAPI is not generated from the Zod contracts yet | API consumers read `packages/contracts` and `docs/R1-RELEASE-REPORT.md` §4 instead | Add generation in R2 (needs an approved dependency) |
| KI-18 | On the web build the refresh token is kept in memory only (no keystore on web), so a page reload signs out | Web is a development aid, not a release target; Android/iOS use the keystore | By design (AD-M-024) |
| KI-19 | Doctor call requests (nursing) are not built: the roadmap places them with messaging in R7 | Nurses cannot page a doctor from the app in R1 | R7 |
| KI-20 | Schedules, leave, fees, prices and catalogue have management APIs (audited) but no mobile screens yet | Changes need the API (or the synthetic seed) in R1 | R2 administration screens |
| KI-21 | Release 1 gate not met: no Android emulator or physical-device run of the journey (see KI-1) | Release 1 cannot be signed off | Run the device checklist when an Android SDK or phone is available |

**KI-12 update (2026-11-06, R1.13): fixed in the app bundle, still installed.** Metro and Jest
resolve `decode-uri-component` to `apps/mobile/shims/decode-uri-component.js`, a linear-time
decoder with the same output for valid input (tests compare it with the original). Measured with the
installed original: 3,002 characters → 10.1 s; through the shim (Expo Router's `query-string`):
under 100 ms. The Android export's Hermes bytecode contains the shim and none of the original's
functions. The package is still in `node_modules`, so `npm audit` still reports 5 high (2
advisories); the exception entry remains (review 2026-12-31) and is removed with Expo SDK 58. The
incoming-link guard stays as defence in depth. There is no native component in this advisory: the
native layer only registers the `hospitalos:` scheme and passes the link string to JavaScript.

| # | Issue | Impact | Resolution |
|---|---|---|---|
| KI-22 | ~~Tab bar truncated "Work Queue" at 360 dp~~ **Resolved 2026-11-06 (UI redesign):** custom floating tab bar, visible label "Queue", accessible name "Work Queue" | — | Closed |
| KI-23 | Only one demo LAB account exists, so "verify by a different person" was exercised with `demo-sa` (which holds `lab_result:verify`); the database suite covers two technicians | None for correctness | Add a second LAB account through Staff accounts when needed |

| # | Issue | Impact | Resolution |
|---|---|---|---|
| KI-24 | Metro's file watcher does not see edits on the development Mac (no watchman; fsevents install script blocked, KI-11) | The Expo dev server must be restarted to show changes | Install watchman or approve fsevents, as a separate approved change |
| KI-25 | The redesigned UI has been checked on the web preview only; blur, Reanimated springs, keyboard behaviour and TalkBack are unverified on Android | Android visual sign-off pending | Android emulator and phone run (KI-1) |
