import { seedCatalogue } from '../seed/catalogue';
import { seedDemoAccounts } from '../seed/demo-accounts';
import { seedAccessModel, seedBaseDepartments } from '../seed/reference';

import { fail, openOwnerDatabase } from './owner-db';

/** `npm run db:seed:demo`: demo accounts (development and test only), printed once. */
try {
  const { db, close } = await openOwnerDatabase(process.argv[2]);
  try {
    await seedAccessModel(db);
    await seedBaseDepartments(db);
    await seedCatalogue(db, process.env.NODE_ENV);
    const credentials = await seedDemoAccounts(db, process.env.NODE_ENV);
    process.stdout.write(
      'Demo accounts (synthetic, development only). Shown once; not stored anywhere:\n',
    );
    for (const c of credentials)
      process.stdout.write(`  ${c.role.padEnd(4)} ${c.username.padEnd(10)} ${c.password}\n`);
  } finally {
    await close();
  }
} catch (error) {
  fail(error);
}
