import { z } from 'zod';

/** Shared building blocks for API schemas. */
export const uuidSchema = z.uuid();

/** ISO 8601 timestamp in UTC, as the API returns it. */
export const timestampSchema = z.iso.datetime({ offset: true });

/** A calendar date in the hospital time zone (`YYYY-MM-DD`). */
export const dateSchema = z.iso.date();

/** A reason typed by a person for an audited action. */
export const reasonSchema = z
  .string()
  .trim()
  .min(3, 'Give a reason (at least 3 characters)')
  .max(500);

/** Money is always integer paise. */
export const paiseSchema = z.number().int().nonnegative().max(1_000_000_000_00);

export const cursorPageQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
