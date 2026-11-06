import type { ErrorEnvelope } from '@hospitalos/contracts';
import type { ErrorRequestHandler, RequestHandler } from 'express';

import { postgresErrorOf } from '../db/sql';
import { toHttpError } from '../lib/errors';
import type { Logger } from '../lib/logger';

import { requestIdOf } from './request-id';

/** Every unmatched route: the standard 404 envelope. */
export const notFound: RequestHandler = (req, res) => {
  const body: ErrorEnvelope = {
    error: { code: 'NOT_FOUND', message: 'Not found.', requestId: requestIdOf(req) },
  };
  res.status(404).json(body);
};

/** Turns any thrown error into the standard envelope. Server errors are logged, never echoed. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    const requestId = requestIdOf(req);
    const mapped = toHttpError(error);
    if (mapped.status >= 500) {
      // Never the error object itself: query errors carry the query's parameters and message,
      // which can hold token hashes or patient values. Only safe identifying fields are logged.
      const pg = postgresErrorOf(error);
      logger.error(
        {
          requestId,
          errorName: error instanceof Error ? error.name : typeof error,
          ...(pg ? { pgErrorCode: pg.code, pgConstraint: pg.constraint ?? null } : {}),
        },
        'request failed',
      );
    }
    if (res.headersSent) return;
    const body: ErrorEnvelope = {
      error: {
        code: mapped.code,
        message: mapped.message,
        requestId,
        ...(mapped.fields ? { fields: [...mapped.fields] } : {}),
      },
    };
    res.status(mapped.status).json(body);
  };
}
