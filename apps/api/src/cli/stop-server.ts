import { readFileSync } from 'node:fs';
import { request } from 'node:http';

import { CONTROL_HOST } from '../http/control';

/**
 * `npm run stop -w @hospitalos/api` (and, from phase W2, stop.bat): asks the running server to
 * shut down gracefully through its loopback control listener. Reads CONTROL_PORT and
 * CONTROL_TOKEN_FILE from the same settings as the server. Exit codes: 0 stop accepted,
 * 1 not configured or refused, 3 server not running.
 */
const port = Number(process.env.CONTROL_PORT);
const tokenFile = process.env.CONTROL_TOKEN_FILE ?? '';

function fail(message: string, code = 1): never {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

if (!Number.isInteger(port) || port < 1 || port > 65535 || tokenFile === '') {
  fail('CONTROL_PORT and CONTROL_TOKEN_FILE must be set to stop the server.');
}

let token: string;
try {
  token = readFileSync(tokenFile, 'utf8').trim();
} catch {
  fail('The server is not running (no control token file).', 3);
}

const req = request(
  {
    host: CONTROL_HOST,
    port,
    path: '/shutdown',
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5_000,
  },
  (res) => {
    res.resume();
    if (res.statusCode === 202) {
      process.stdout.write('Stop requested; the server is shutting down.\n');
      return;
    }
    fail(`The server refused the stop request (HTTP ${String(res.statusCode)}).`);
  },
);
req.on('timeout', () => {
  req.destroy();
  fail('The server did not answer the stop request in time.');
});
req.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'ECONNREFUSED') fail('The server is not running.', 3);
  fail('The stop request failed.');
});
req.end();
