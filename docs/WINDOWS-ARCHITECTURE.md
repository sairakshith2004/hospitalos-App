# HospitalOS: Windows-first architecture

Approved by the product owner on 2026-11-18 (decisions AD-M-025 to AD-M-033). This document
describes the target and records what each phase has delivered. **Nothing here has been tested on
Windows yet**: phase W1 was built and verified on macOS only. Windows compatibility is claimed only
after the W2 tests run on a real Windows machine.

## 1. Target

- One central Windows computer runs the HospitalOS server and its PostgreSQL database.
- Staff use Edge or Chrome on hospital PCs over the local network. Nothing is installed on them
  except trusting the hospital certificate once.
- A single-computer demonstration mode runs everything on one PC with synthetic data.
- Distributed as a ZIP: `setup.bat`, `run.bat`, `stop.bat`, `backup.bat`, setup instructions,
  bundled runtimes, compiled builds and the source.
- The Expo mobile app stays and uses the same API over HTTPS.

## 2. Components

| Component | What it is | Network exposure |
|---|---|---|
| HospitalOS server | `node dist/server.js` (Node 24): the existing Express API under `/api` plus the built web app at `/` (`WEB_ROOT`) | One port on the LAN, HTTPS in production |
| Control listener | Same process, `127.0.0.1:CONTROL_PORT`, `POST /shutdown` with a per-run token | Loopback only |
| PostgreSQL 17 | Bundled portable binaries, data in `data\pgdata` (W2) | Loopback only |
| Browser app | `apps/web` (React, TypeScript, Vite), static files | Served by the server |
| Mobile app | `apps/mobile` (Expo), unchanged | Calls the server over HTTPS |

## 3. Modes

| | Single-computer demo | Central LAN server |
|---|---|---|
| `NODE_ENV` | `development` | `production` |
| Database | `hospitalos_demo`, synthetic seed, DEMO DATA labels | `hospitalos_prod`, no demo accounts (start-up refuses otherwise) |
| `HOST` | `127.0.0.1` | The server's LAN address |
| Protocol | HTTP on loopback | HTTPS required (start-up refuses otherwise) |
| First account | Demo accounts, passwords printed once | `bootstrap-admin` |

## 4. Settings added in W1

All optional; empty means off. See `.env.example`.

| Setting | Effect |
|---|---|
| `WEB_ROOT` | Serves the built web app at `/`; client routes fall back to `index.html`; `/api/*` is never answered by it; refuses to start if `index.html` is missing |
| `TLS_CERT_FILE`, `TLS_KEY_FILE` | HTTPS listener (TLS 1.2+). Both or neither. Required in production on a non-loopback `HOST` |
| `LOG_FILE` | Appends the same redacted JSON log lines to a file (folder created). No rotation yet (W2) |
| `CONTROL_PORT`, `CONTROL_TOKEN_FILE` | Loopback control listener for graceful stop. Both or neither; must differ from `PORT` |

Database rules added: production requires `hospitalos_prod`; `hospitalos_prod` is refused outside
production. Migration and operator targets: `dev`, `test`, `demo`, `prod`.

## 5. Start and stop

Today (W1, developer commands):

```sh
npm run build            # apps/web/dist and apps/api/dist
npm run start:dist       # node dist/server.js with the root .env
npm run stop:api         # graceful stop through the control listener
```

`stop:api` exit codes: 0 stop accepted, 1 not configured or refused, 3 server not running.

Planned (W2): `run.bat` starts PostgreSQL (`pg_ctl`), applies migrations as `hos_owner`, starts the
server as `hos_app`, waits for `/api/ready` and opens the browser. `stop.bat` calls the control
listener, waits for the process to exit, then runs `pg_ctl stop -m fast`.

## 6. Mandatory before real hospital use

These are requirements, not options (owner condition, 2026-11-18). None is complete yet.

| Requirement | Status |
|---|---|
| HTTPS on the network | Enforced and built in W1; certificate generation and client trust in W2 |
| Secure web session (survives reload without exposing tokens to scripts) | Direction approved (AD-M-029); design and build in W3 |
| Database backups | `backup.bat` in W2 |
| Tested recovery | Restore drill on a second machine in W6 |
| Security, clinical, privacy and legal review | Before any real patient data (R9) |

Until then, synthetic data only.

## 7. Phase status

| Phase | Status |
|---|---|
| W0 Approval | Done 2026-11-18 |
| W1 Server readiness | Built and verified on macOS; awaiting owner review |
| W2 to W6 | Not started |
