import { uuidSchema } from '@hospitalos/contracts';

import { AppError } from '../lib/errors';

/** A route's `:id`, which must be a UUID; anything else is simply not found. */
export function idParam(value: unknown): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return parsed.data;
}
