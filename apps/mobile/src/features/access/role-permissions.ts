/**
 * Which permissions each role grants, from `@hospitalos/contracts` (the reference permission model,
 * docs/MOBILE-ROLE-MODULE-MATRIX.md §3). The API computes a signed-in user's permissions from the
 * database on every request; the app never derives them from this table. It is used by the
 * development role preview and by tests that keep the matrix document in agreement.
 */
export { ROLE_PERMISSIONS } from '@hospitalos/contracts';
