import type { Permission, RoleCode } from '@hospitalos/contracts';
import type { Request } from 'express';

import { AppError } from '../lib/errors';
import { requestIdOf } from '../middleware/request-id';

/** Who is calling, as established by the authenticate middleware from the bearer token. */
export type AuthContext = Readonly<{
  userId: string;
  sessionId: string;
  roles: readonly RoleCode[];
  permissions: ReadonlySet<Permission>;
  mustChangePassword: boolean;
}>;

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/** The authenticated caller. Routes behind `authenticate` always have one. */
export function authOf(req: Request): AuthContext {
  if (req.auth === undefined) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return req.auth;
}

/** Where a request came from, for audit and rate limits. Never trusted for authorization. */
export type RequestMeta = Readonly<{ requestId: string; ip: string }>;

export function metaOf(req: Request): RequestMeta {
  return { requestId: requestIdOf(req), ip: (req.ip ?? 'unknown').slice(0, 64) };
}
