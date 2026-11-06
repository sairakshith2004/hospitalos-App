import type { RequestHandler } from 'express';

/**
 * CORS for browser clients (the Expo web build in development). Off unless origins are listed in
 * CORS_ORIGINS. Safe with bearer tokens: the API never uses cookies, so there is no ambient
 * credential for another site to ride on. Native apps don't send Origin and are unaffected.
 */
export function cors(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get('origin');
    if (origin !== undefined && allowed.has(origin)) {
      res.set({
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin',
        'Access-Control-Allow-Headers':
          'Authorization, Content-Type, Idempotency-Key, X-App-Version, X-App-Platform, X-Request-Id',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Expose-Headers': 'X-Request-Id',
        'Access-Control-Max-Age': '600',
      });
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  };
}
