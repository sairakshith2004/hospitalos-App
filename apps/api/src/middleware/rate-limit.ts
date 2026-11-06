import type { ErrorEnvelope } from '@hospitalos/contracts';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';

import { requestIdOf } from './request-id';

export type RateLimitOptions = Readonly<{ windowMs: number; max: number }>;

/** Liveness and readiness probes are never limited. */
const UNLIMITED_PATHS = new Set(['/api/health', '/api/ready']);

/**
 * Rate-limiting foundation: a general per-IP limit for every API route. Stricter limits for
 * sign-in and password reset are added with those endpoints in phase 1.2. Counts are kept in
 * memory (one API process); a shared store is needed before running several processes.
 */
export function apiRateLimit({ windowMs, max }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req) => UNLIMITED_PATHS.has(req.path),
    handler: (req, res) => {
      const body: ErrorEnvelope = {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait and try again.',
          requestId: requestIdOf(req),
        },
      };
      res.status(429).json(body);
    },
  });
}
