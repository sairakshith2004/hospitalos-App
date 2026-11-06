import { userInfo } from 'node:os';

import { operatorResetPassword } from '../auth/operator';

import { fail, openOwnerDatabase } from './owner-db';
import { ask } from './prompt';

/** `npm run api:reset-password -- dev|test`: operator password reset for any account. */
try {
  const { db, close } = await openOwnerDatabase(process.argv[2]);
  try {
    const username = (await ask('Username: ')).trim().toLowerCase();
    const password = await ask('New password (12+ characters, not shown): ', true);
    const again = await ask('New password again: ', true);
    if (password !== again) throw new Error('The passwords do not match. Nothing was changed.');
    const forceChange =
      (await ask('Require a new password at next sign-in? [Y/n] ')).trim().toLowerCase() !== 'n';
    await operatorResetPassword(db, username, password, forceChange, userInfo().username);
    process.stdout.write('Password reset. Every session of that account has ended.\n');
  } finally {
    await close();
  }
} catch (error) {
  fail(error);
}
