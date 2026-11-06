import type { z } from '@hospitalos/contracts';

import { ApiError } from './errors';

/** Field messages by path, from a server validation error or a local schema check. */
export type FieldMessages = Readonly<Record<string, string>>;

export function serverFieldErrors(error: unknown): FieldMessages {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.fields.map((field) => [field.path, field.message]));
}

export function schemaFieldErrors(result: z.ZodSafeParseResult<unknown>): FieldMessages {
  if (result.success) return {};
  const messages: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    messages[path] ??= issue.message;
  }
  return messages;
}
