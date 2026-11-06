import { describe, expect, it } from 'vitest';

import { REDACT_PATHS } from '../src/security/redaction';

import { captureLogger } from './support/capture-logger';

const SENTINEL = 'value-that-must-not-be-logged';

describe('log redaction', () => {
  it('redacts every sensitive field, at the top level and one level down', () => {
    const { logger, lines } = captureLogger();
    logger.info(
      {
        password: SENTINEL,
        token: SENTINEL,
        accessToken: SENTINEL,
        refreshToken: SENTINEL,
        code: SENTINEL,
        connectionString: SENTINEL,
        DATABASE_URL: SENTINEL,
        body: {
          password: SENTINEL,
          newPassword: SENTINEL,
          currentPassword: SENTINEL,
          token: SENTINEL,
          accessToken: SENTINEL,
          refreshToken: SENTINEL,
          resetCode: SENTINEL,
        },
        req: { headers: { authorization: SENTINEL, cookie: SENTINEL } },
      },
      'sensitive event',
    );
    const logged = lines().join('\n');
    expect(logged).toContain('sensitive event');
    expect(logged).not.toContain(SENTINEL);
  });

  it('covers the paths the API depends on', () => {
    for (const path of ['req.headers.authorization', '*.password', '*.refreshToken']) {
      expect(REDACT_PATHS).toContain(path);
    }
  });
});
