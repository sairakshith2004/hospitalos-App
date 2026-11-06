import {
  changePasswordRequestSchema,
  currentUserSchema,
  forgotPasswordRequestSchema,
  refreshRequestSchema,
  resetPasswordRequestSchema,
  signInRequestSchema,
  signInResponseSchema,
  tokenPairSchema,
  versionPolicySchema,
} from '@hospitalos/contracts';
import { Router, type Request } from 'express';

import { authOf, metaOf } from '../../http/context';
import type { SettingsProvider } from '../../settings';

import type { AuthService, ClientInfo } from './auth.service';

function clientOf(req: Request, deviceLabel: string): ClientInfo {
  const platform = req.get('x-app-platform');
  const version = req.get('x-app-version');
  return {
    deviceLabel,
    platform: platform === 'android' || platform === 'ios' || platform === 'web' ? platform : null,
    appVersion: version !== undefined && /^\d+\.\d+\.\d+$/.test(version) ? version : null,
  };
}

/** Routes that work without a session: sign-in, refresh, forgot and reset, version policy. */
export function publicAuthRouter(auth: AuthService, settings: SettingsProvider): Router {
  const router = Router();

  router.post('/auth/sessions', async (req, res) => {
    const body = signInRequestSchema.parse(req.body);
    const result = await auth.signIn(
      body.username,
      body.password,
      clientOf(req, body.deviceLabel),
      metaOf(req),
    );
    res.status(201).set('Cache-Control', 'no-store').json(signInResponseSchema.parse(result));
  });

  router.post('/auth/token', async (req, res) => {
    const body = refreshRequestSchema.parse(req.body);
    const tokens = await auth.refresh(body.refreshToken, metaOf(req));
    res.set('Cache-Control', 'no-store').json(tokenPairSchema.parse(tokens));
  });

  router.post('/auth/password/forgot', async (req, res) => {
    const body = forgotPasswordRequestSchema.parse(req.body);
    await auth.requestPasswordReset(body.identifier, metaOf(req));
    res.status(202).json({ status: 'accepted' });
  });

  router.post('/auth/password/reset', async (req, res) => {
    const body = resetPasswordRequestSchema.parse(req.body);
    await auth.resetPassword(body.identifier, body.code, body.newPassword, metaOf(req));
    res.status(204).end();
  });

  router.get('/app/version-policy', async (_req, res) => {
    const s = await settings.get();
    res.json(
      versionPolicySchema.parse({
        android: { minimum: s.app_min_version_android, latest: s.app_latest_version_android },
        ios: { minimum: s.app_min_version_ios, latest: s.app_latest_version_ios },
      }),
    );
  });

  return router;
}

/** Routes for the signed-in user. Mounted behind `authenticate`. */
export function sessionRouter(auth: AuthService): Router {
  const router = Router();

  router.get('/auth/me', async (req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .json(currentUserSchema.parse(await auth.me(authOf(req).userId)));
  });

  router.get('/auth/me/permissions', async (req, res) => {
    const me = await auth.me(authOf(req).userId);
    res.set('Cache-Control', 'no-store').json({ roles: me.roles, permissions: me.permissions });
  });

  router.delete('/auth/sessions/current', async (req, res) => {
    const { userId, sessionId } = authOf(req);
    await auth.signOut(userId, sessionId, metaOf(req));
    res.status(204).end();
  });

  router.post('/auth/sessions/logout-all', async (req, res) => {
    const ended = await auth.signOutEverywhere(authOf(req).userId, metaOf(req));
    res.json({ sessionsEnded: ended });
  });

  router.post('/auth/password', async (req, res) => {
    const { userId, sessionId } = authOf(req);
    const body = changePasswordRequestSchema.parse(req.body);
    await auth.changePassword(
      userId,
      sessionId,
      body.currentPassword,
      body.newPassword,
      metaOf(req),
    );
    res.status(204).end();
  });

  return router;
}
