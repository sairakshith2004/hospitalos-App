/**
 * Log fields that are always replaced before a log line is written. Patient data, passwords,
 * tokens, reset codes and connection strings never appear in logs (architecture §3 rule 8).
 * Later phases add their own fields here; the log-capture test checks every path.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  'newPassword',
  '*.newPassword',
  'currentPassword',
  '*.currentPassword',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'code',
  '*.resetCode',
  'connectionString',
  '*.connectionString',
  'DATABASE_URL',
  '*.DATABASE_URL',
] as const;

export const REDACTED = '[redacted]';
