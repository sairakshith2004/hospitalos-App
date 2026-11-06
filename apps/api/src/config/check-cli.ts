import { ConfigError, checkAllSettings } from './env';

/**
 * `npm run db:env:check`: validates every setting in the root .env without connecting to
 * anything. Prints setting names only, never values.
 */
try {
  for (const line of checkAllSettings(process.env)) process.stdout.write(`${line}\n`);
  process.stdout.write('db:env:check passed.\n');
} catch (error) {
  process.stderr.write(
    `${error instanceof ConfigError ? error.message : 'Invalid configuration.'}\n`,
  );
  process.exit(1);
}
