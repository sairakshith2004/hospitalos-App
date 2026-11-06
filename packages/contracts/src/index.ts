export { isRoleCode, ROLE_CODES, ROLE_NAMES, type RoleCode } from './roles';
export { isPermission, PERMISSIONS, ROLE_PERMISSIONS, type Permission } from './permissions';
export {
  ERROR_CODES,
  errorEnvelopeSchema,
  fieldErrorSchema,
  type ErrorCode,
  type ErrorEnvelope,
  type FieldError,
} from './errors';
export {
  healthResponseSchema,
  readyResponseSchema,
  type HealthResponse,
  type ReadyResponse,
} from './health';
export * from './common';
export * from './auth';
export * from './reference';
export * from './patients';
export * from './scheduling';
export * from './clinical';
export * from './pharmacy';
export * from './lab';
export * from './billing';
export * from './dashboard';

/** The zod instance these schemas use. The app imports it from here (one zod, never two). */
export { z } from 'zod';
