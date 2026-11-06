import { seedAccessModel, seedBaseDepartments } from '../seed/reference';

import { fail, openOwnerDatabase } from './owner-db';

/** `npm run db:seed` / `db:seed:test`: reference data needed in every environment. */
try {
  const { db, close, target } = await openOwnerDatabase(process.argv[2]);
  try {
    const access = await seedAccessModel(db);
    await seedBaseDepartments(db);
    process.stdout.write(
      `seeded ${target}: ${access.roles} roles, ${access.permissions} permissions, ${access.grants} role grants\n`,
    );
  } finally {
    await close();
  }
} catch (error) {
  fail(error);
}
