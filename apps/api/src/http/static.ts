import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import express, { type RequestHandler, type Router } from 'express';

/**
 * Serves the built web app (apps/web/dist) from the API's own origin, so browsers need no CORS
 * and the hospital network exposes one port. Mounted after every API route:
 *
 * - Files under the web root are served as they are; hashed build assets (`/assets/…`) are cached
 *   for a year, everything else (index.html) is revalidated on every load.
 * - Any other GET or HEAD outside `/api` answers index.html so client-side routes survive a reload.
 * - Nothing under `/api` is ever answered here: unknown API paths keep their 401/404 envelopes.
 * - Dotfiles are refused and directory listings never happen.
 */
export function webAppRouter(webRoot: string, apiPrefix: string): Router {
  const root = resolve(webRoot);
  const index = join(root, 'index.html');
  if (!existsSync(index) || !statSync(index).isFile()) {
    throw new Error('WEB_ROOT: index.html was not found (build the web app first)');
  }

  const router = express.Router();
  const isApiPath: (path: string) => boolean = (path) =>
    path === apiPrefix || path.startsWith(`${apiPrefix}/`);

  const skipApi: RequestHandler = (req, _res, next) => {
    if (isApiPath(req.path)) {
      next('router');
      return;
    }
    next();
  };

  router.use(skipApi);
  router.use(
    express.static(root, {
      dotfiles: 'deny',
      index: false,
      redirect: false,
      setHeaders: (res, path) => {
        const immutable = path.startsWith(join(root, 'assets'));
        res.setHeader(
          'Cache-Control',
          immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    }),
  );
  router.get(/.*/, (req, res, next) => {
    // A missing file with an extension (e.g. /favicon.png) is a real 404, not the app shell.
    if (/\.[a-z0-9]+$/i.test(req.path)) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index, { dotfiles: 'deny' });
  });
  return router;
}
