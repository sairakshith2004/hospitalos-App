import { userInfo } from 'node:os';

import { bootstrapSuperAdmin } from '../auth/operator';

import { fail, openOwnerDatabase } from './owner-db';
import { ask } from './prompt';

/** `npm run api:bootstrap-admin -- dev|test`: create the first Super Admin, interactively. */
try {
  const { db, close } = await openOwnerDatabase(process.argv[2]);
  try {
    const username = await ask('Username: ');
    const fullName = await ask('Full name: ');
    const email = (await ask('Work email (optional): ')).trim();
    const password = await ask('Password (12+ characters, not shown): ', true);
    const again = await ask('Password again: ', true);
    if (password !== again) throw new Error('The passwords do not match. Nothing was changed.');
    const forceChange =
      (await ask('Require a new password at first sign-in? [y/N] ')).trim().toLowerCase() === 'y';
    await bootstrapSuperAdmin(
      db,
      {
        username,
        fullName,
        ...(email ? { email } : {}),
        password,
        mustChangePassword: forceChange,
      },
      userInfo().username,
    );
    process.stdout.write('Super Admin created.\n');
  } finally {
    await close();
  }
} catch (error) {
  fail(error);
}
