import { healthResponseSchema, readyResponseSchema } from '@hospitalos/contracts';

export type ServerStatus =
  { kind: 'checking' } | { kind: 'ready' } | { kind: 'not-ready' } | { kind: 'unreachable' };

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Reads the API's public probes (same origin, no credentials): `/api/health` says the server
 * process answers, `/api/ready` says the database is reachable and migrated. Bodies are checked
 * against the shared contracts, so a different service on the port never reads as healthy.
 */
export async function checkServer(fetcher: Fetcher): Promise<ServerStatus> {
  const init: RequestInit = { cache: 'no-store', credentials: 'omit' };
  try {
    const health = await fetcher('/api/health', init);
    if (!health.ok || !healthResponseSchema.safeParse(await health.json()).success) {
      return { kind: 'unreachable' };
    }
  } catch {
    return { kind: 'unreachable' };
  }
  try {
    const ready = await fetcher('/api/ready', init);
    return ready.ok && readyResponseSchema.safeParse(await ready.json()).success
      ? { kind: 'ready' }
      : { kind: 'not-ready' };
  } catch {
    return { kind: 'not-ready' };
  }
}
