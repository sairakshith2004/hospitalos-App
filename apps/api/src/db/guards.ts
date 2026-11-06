import { z } from 'zod';

/**
 * Database identity guard (architecture §7). The API and the migration runner refuse to work
 * against any database whose name is not explicitly allowed, as any user other than the expected
 * one, or as a user with administrative powers. This makes the reference project's `hms_*`
 * databases unreachable even with a wrong connection string.
 */
export class DatabaseIdentityError extends Error {
  override name = 'DatabaseIdentityError';
}

export type Queryable = {
  query: (text: string) => Promise<{ rows: unknown[] }>;
};

const identityRow = z.object({
  database: z.string(),
  user: z.string(),
  superuser: z.boolean(),
  create_role: z.boolean(),
  create_db: z.boolean(),
  replication: z.boolean(),
  bypass_rls: z.boolean(),
});

export type DatabaseIdentity = Readonly<{
  database: string;
  user: string;
  superuser: boolean;
  createRole: boolean;
  createDb: boolean;
  replication: boolean;
  bypassRls: boolean;
}>;

export type IdentityExpectations = Readonly<{
  expectedUser: string;
  allowedDatabases: readonly string[];
}>;

export async function readIdentity(db: Queryable): Promise<DatabaseIdentity> {
  const { rows } = await db.query(
    `select current_database() as database, current_user as "user",
            r.rolsuper as superuser, r.rolcreaterole as create_role, r.rolcreatedb as create_db,
            r.rolreplication as replication, r.rolbypassrls as bypass_rls
       from pg_roles r where r.rolname = current_user`,
  );
  const row = identityRow.parse(rows[0]);
  return {
    database: row.database,
    user: row.user,
    superuser: row.superuser,
    createRole: row.create_role,
    createDb: row.create_db,
    replication: row.replication,
    bypassRls: row.bypass_rls,
  };
}

/** Lists every problem with the identity. Database and role names are not secrets. */
export function identityProblems(
  identity: DatabaseIdentity,
  { expectedUser, allowedDatabases }: IdentityExpectations,
): string[] {
  const problems: string[] = [];
  if (!allowedDatabases.includes(identity.database)) {
    problems.push(`database "${identity.database}" is not in the allowed list`);
  }
  if (identity.user !== expectedUser) {
    problems.push(`connected as "${identity.user}", expected "${expectedUser}"`);
  }
  if (identity.superuser) problems.push('the database user is a superuser');
  if (identity.createRole) problems.push('the database user can create roles');
  if (identity.createDb) problems.push('the database user can create databases');
  if (identity.replication) problems.push('the database user has replication rights');
  if (identity.bypassRls) problems.push('the database user bypasses row-level security');
  return problems;
}

export async function verifyDatabaseIdentity(
  db: Queryable,
  expectations: IdentityExpectations,
): Promise<DatabaseIdentity> {
  const identity = await readIdentity(db);
  const problems = identityProblems(identity, expectations);
  if (problems.length > 0) {
    throw new DatabaseIdentityError(`Refusing this database connection: ${problems.join('; ')}.`);
  }
  return identity;
}
