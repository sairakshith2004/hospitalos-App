import { config } from '@/config/env';

/**
 * Development tooling (role preview, component showcase, demo sign-in) is compiled out of
 * behaviour in production builds. Never use this flag for access control decisions.
 */
export const devToolsEnabled: boolean = config.appEnv !== 'production';
