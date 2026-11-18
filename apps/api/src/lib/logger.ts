import { pino, type DestinationStream, type Logger, type LevelWithSilent } from 'pino';

import { REDACTED, REDACT_PATHS } from '../security/redaction';

export type { Logger };

/** Structured JSON logger with sensitive fields redacted. */
export function createLogger(level: LevelWithSilent, destination?: DestinationStream): Logger {
  const options = {
    level,
    base: { service: 'hospitalos-api' },
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
  };
  return destination ? pino(options, destination) : pino(options);
}

/**
 * The server's logger: stdout, plus an appended log file when one is configured (Windows
 * installations keep logs in data\logs). Both outputs carry the same redacted lines. The folder
 * is created if missing. Rotation is not handled here (Windows packaging, phase W2).
 */
export function createServerLogger(level: LevelWithSilent, logFile?: string): Logger {
  if (logFile === undefined) return createLogger(level);
  const file = pino.destination({ dest: logFile, mkdir: true, append: true, sync: false });
  return createLogger(
    level,
    pino.multistream([
      { level: 'trace', stream: process.stdout },
      { level: 'trace', stream: file },
    ]),
  );
}
