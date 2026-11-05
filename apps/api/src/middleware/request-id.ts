import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Incoming IDs are accepted only in this safe shape; anything else is replaced. */
const VALID_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Picks the request's ID (a valid incoming X-Request-Id, or a new UUID) and echoes it back. */
export function resolveRequestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, id);
  return id;
}

/** The request ID as a string, whatever form the logger stored it in. */
export function requestIdOf(req: IncomingMessage & { id?: unknown }): string {
  return typeof req.id === 'string' ? req.id : 'unknown';
}
