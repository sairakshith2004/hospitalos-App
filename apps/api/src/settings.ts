import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { one, type Executor } from './db/sql';

/** Hospital and security settings (architecture §5.6). Each value is range-checked in the DB. */
const settingsRow = z.object({
  name: z.string(),
  timezone: z.string(),
  near_expiry_days: z.number().int(),
  care_window_before_days: z.number().int(),
  care_window_after_days: z.number().int(),
  follow_up_grace_days: z.number().int(),
  prescription_validity_days: z.number().int(),
  access_token_minutes: z.number().int(),
  session_idle_minutes: z.number().int(),
  session_absolute_hours: z.number().int(),
  login_lockout_failures: z.number().int(),
  login_lockout_minutes: z.number().int(),
  login_max_failures_per_ip: z.number().int(),
  password_reset_code_minutes: z.number().int(),
  password_reset_max_requests_per_account_hour: z.number().int(),
  password_reset_max_requests_per_ip_hour: z.number().int(),
  password_reset_max_attempts_per_code: z.number().int(),
  app_min_version_android: z.string().nullable(),
  app_min_version_ios: z.string().nullable(),
  app_latest_version_android: z.string().nullable(),
  app_latest_version_ios: z.string().nullable(),
});

export type HospitalSettings = z.infer<typeof settingsRow>;

export type SettingsProvider = Readonly<{
  get: (db?: Executor) => Promise<HospitalSettings>;
  invalidate: () => void;
}>;

/** Reads settings, re-reading at most every `ttlMs` (60 s in the API; 0 in tests). */
export function createSettingsProvider(db: Executor, ttlMs = 60_000): SettingsProvider {
  let cached: { value: HospitalSettings; at: number } | undefined;
  return {
    async get(executor = db) {
      if (cached && Date.now() - cached.at < ttlMs) return cached.value;
      const value = await one(
        executor,
        sql`select * from hospital_settings where id = 1`,
        settingsRow,
      );
      cached = { value, at: Date.now() };
      return value;
    },
    invalidate() {
      cached = undefined;
    },
  };
}
