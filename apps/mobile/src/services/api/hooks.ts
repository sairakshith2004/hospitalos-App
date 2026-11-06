import type { z } from '@hospitalos/contracts';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { useApi } from '@/features/session/SessionProvider';

/**
 * Server data for screens. Every list and figure comes from the API (DO-1); nothing is cached on
 * disk. Queues refresh when focused and every 15 seconds while open (workflows §1).
 */
export function useApiQuery<T extends z.ZodType>(
  key: readonly unknown[],
  path: string | null,
  schema: T,
  options: Partial<Pick<UseQueryOptions<z.infer<T>>, 'refetchInterval' | 'enabled'>> = {},
) {
  const api = useApi();
  return useQuery({
    queryKey: key,
    queryFn: () => api.request(path ?? '', schema),
    enabled: path !== null && (options.enabled ?? true),
    ...(options.refetchInterval !== undefined ? { refetchInterval: options.refetchInterval } : {}),
  });
}

/** A write. `invalidate` lists query keys to refresh afterwards. */
export function useApiMutation<TBody, T extends z.ZodType>(
  build: (body: TBody) => { path: string; method?: string; body?: unknown; idempotent?: boolean },
  schema: T,
  invalidate: readonly (readonly unknown[])[] = [],
) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => {
      const request = build(body);
      return api.request(request.path, schema, {
        method: request.method ?? 'POST',
        ...(request.body !== undefined ? { body: request.body } : {}),
        ...(request.idempotent ? { headers: { 'Idempotency-Key': newIdempotencyKey() } } : {}),
      });
    },
    onSuccess: () =>
      Promise.all(invalidate.map((queryKey) => client.invalidateQueries({ queryKey }))),
  });
}

/**
 * A UUID v4 for Idempotency-Key. It only needs to be unique per attempt (it is not a secret), so
 * when the platform has no crypto.randomUUID a Math.random fallback is acceptable.
 */
export function newIdempotencyKey(): string {
  const cryptoObject: unknown = Reflect.get(globalThis, 'crypto');
  if (typeof cryptoObject === 'object' && cryptoObject !== null) {
    const randomUUID: unknown = Reflect.get(cryptoObject, 'randomUUID');
    if (typeof randomUUID === 'function') return String(randomUUID.call(cryptoObject));
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}
