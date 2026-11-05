import { Writable } from 'node:stream';

import { createLogger, type Logger } from '../../src/lib/logger';

/** A logger that writes into memory, so tests can inspect exactly what would be logged. */
export function captureLogger(): { logger: Logger; lines: () => string[] } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString('utf8'));
      callback();
    },
  });
  const logger = createLogger('trace', stream);
  return { logger, lines: () => chunks.join('').split('\n').filter(Boolean) };
}
