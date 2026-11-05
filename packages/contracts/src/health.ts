import { z } from 'zod';

/** `GET /api/health`: the API process is running. It never touches the database. */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * `GET /api/ready`: the API can serve requests, meaning the database answers, passes the
 * identity guard and has the expected migrations. When not ready, the API answers 503 with the error envelope (code NOT_READY).
 */
export const readyResponseSchema = z.object({
  status: z.literal('ready'),
  checks: z.object({
    database: z.literal('ok'),
  }),
});

export type ReadyResponse = z.infer<typeof readyResponseSchema>;
