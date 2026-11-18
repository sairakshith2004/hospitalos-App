import { describe, expect, it } from 'vitest';

import { checkServer, type Fetcher } from '../server-status';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetcherFrom(routes: Record<string, () => Response>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const fetcher = (input: string, init?: RequestInit) => {
    calls.push(input);
    expect(init?.credentials).toBe('omit');
    const route = routes[input];
    return route ? Promise.resolve(route()) : Promise.reject(new TypeError('Failed to fetch'));
  };
  return Object.assign(fetcher, { calls });
}

describe('checkServer', () => {
  it('reports ready when both probes answer with the contract bodies', async () => {
    const fetcher = fetcherFrom({
      '/api/health': () => json(200, { status: 'ok' }),
      '/api/ready': () => json(200, { status: 'ready', checks: { database: 'ok' } }),
    });
    expect(await checkServer(fetcher)).toEqual({ kind: 'ready' });
    expect(fetcher.calls).toEqual(['/api/health', '/api/ready']);
  });

  it('reports not-ready when the database check fails', async () => {
    const fetcher = fetcherFrom({
      '/api/health': () => json(200, { status: 'ok' }),
      '/api/ready': () =>
        json(503, { error: { code: 'NOT_READY', message: 'Not ready.', requestId: 'r' } }),
    });
    expect(await checkServer(fetcher)).toEqual({ kind: 'not-ready' });
  });

  it('reports unreachable when the server is down or another service answers', async () => {
    expect(await checkServer(fetcherFrom({}))).toEqual({ kind: 'unreachable' });
    const imposter = fetcherFrom({ '/api/health': () => json(200, { hello: 'world' }) });
    expect(await checkServer(imposter)).toEqual({ kind: 'unreachable' });
    expect(imposter.calls).toEqual(['/api/health']);
  });
});
