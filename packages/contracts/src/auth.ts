import { z } from 'zod';

import { reasonSchema, timestampSchema, uuidSchema } from './common';
import { PERMISSIONS } from './permissions';
import { ROLE_CODES } from './roles';

/** Password policy (the reference's): 12 to 256 characters. */
export const passwordSchema = z
  .string()
  .min(12, 'At least 12 characters')
  .max(256, 'At most 256 characters');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,39}$/, '3–40 letters, digits, dots, dashes or underscores');

const deviceLabelSchema = z.string().trim().min(1).max(80);

/** POST /api/v1/auth/sessions: sign in. */
export const signInRequestSchema = z.strictObject({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
  deviceLabel: deviceLabelSchema,
});

export const roleCodeSchema = z.enum(ROLE_CODES);
export const permissionSchema = z.enum(PERMISSIONS);

/** The signed-in user, as GET /api/v1/auth/me returns it. */
export const currentUserSchema = z.object({
  id: uuidSchema,
  username: z.string(),
  fullName: z.string(),
  employeeNo: z.string(),
  departmentCode: z.string(),
  designation: z.string(),
  roles: z.array(roleCodeSchema),
  permissions: z.array(permissionSchema),
  mustChangePassword: z.boolean(),
  isDemo: z.boolean(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string().regex(/^hos_at_[A-Za-z0-9_-]{43}$/),
  refreshToken: z.string().regex(/^hos_rt_[A-Za-z0-9_-]{43}$/),
  accessExpiresAt: timestampSchema,
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const signInResponseSchema = tokenPairSchema.extend({ user: currentUserSchema });
export type SignInResponse = z.infer<typeof signInResponseSchema>;

/** POST /api/v1/auth/token: rotate the refresh token. */
export const refreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(200),
});

/** POST /api/v1/auth/password: change own password. */
export const changePasswordRequestSchema = z.strictObject({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});

/** POST /api/v1/auth/password/forgot. Always 202 with the same body. */
export const forgotPasswordRequestSchema = z.strictObject({
  identifier: z.string().trim().min(1).max(254),
});
export const forgotPasswordResponseSchema = z.object({ status: z.literal('accepted') });

/** POST /api/v1/auth/password/reset. */
export const resetPasswordRequestSchema = z.strictObject({
  identifier: z.string().trim().min(1).max(254),
  code: z.string().regex(/^\d{8}$/, 'Enter the 8-digit code'),
  newPassword: passwordSchema,
});

/** GET /api/v1/app/version-policy (public). */
export const versionPolicySchema = z.object({
  android: z.object({ minimum: z.string().nullable(), latest: z.string().nullable() }),
  ios: z.object({ minimum: z.string().nullable(), latest: z.string().nullable() }),
});

// ------------------------------------------------------------------ staff administration (1.2b)

/** POST /api/v1/admin/staff (user:create). The temporary password is typed by HR. */
export const createStaffRequestSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(120),
  employeeNo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, '2–20 capital letters, digits or dashes'),
  departmentCode: z.string().trim().toUpperCase().min(2).max(20),
  designation: z.string().trim().min(1).max(80),
  username: usernameSchema,
  email: z.email().max(254).optional(),
  temporaryPassword: passwordSchema,
});

export const staffSummarySchema = z.object({
  id: uuidSchema,
  username: z.string(),
  fullName: z.string(),
  employeeNo: z.string(),
  departmentCode: z.string(),
  designation: z.string(),
  email: z.string().nullable(),
  status: z.enum(['active', 'disabled']),
  roles: z.array(roleCodeSchema),
  mustChangePassword: z.boolean(),
  createdAt: timestampSchema,
});
export type StaffSummary = z.infer<typeof staffSummarySchema>;

export const staffListSchema = z.object({ items: z.array(staffSummarySchema) });

/** POST /api/v1/admin/users/:id/roles/grant and …/revoke (user_role:assign). */
export const roleChangeRequestSchema = z.strictObject({
  role: roleCodeSchema,
  reason: reasonSchema,
});

/** POST /api/v1/admin/users/:id/status (user:manage). */
export const statusChangeRequestSchema = z.strictObject({
  status: z.enum(['active', 'disabled']),
  reason: reasonSchema,
});

export const roleListSchema = z.object({
  items: z.array(
    z.object({ code: roleCodeSchema, name: z.string(), permissions: z.array(permissionSchema) }),
  ),
});

export const permissionListSchema = z.object({ items: z.array(permissionSchema) });

export const authAuditEntrySchema = z.object({
  id: z.string(),
  occurredAt: timestampSchema,
  action: z.string(),
  actorUserId: uuidSchema.nullable(),
  actorLabel: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  reason: z.string().nullable(),
});
export const authAuditListSchema = z.object({ items: z.array(authAuditEntrySchema) });
