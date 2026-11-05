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
