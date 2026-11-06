import { z } from 'zod';

import { dateSchema } from './common';

/** One figure on a role's Home screen, always computed by the server from the database. */
export const dashboardMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.enum(['count', 'paise']),
  hint: z.string().nullable(),
});
export const dashboardSchema = z.object({
  date: dateSchema,
  role: z.string(),
  metrics: z.array(dashboardMetricSchema),
  tasks: z.array(z.object({ key: z.string(), title: z.string(), count: z.number().int() })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
