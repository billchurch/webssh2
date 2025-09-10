// server
// app/constants.ts

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Error messages
 */
export const MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid credentials format',
  SSH_CONNECTION_ERROR: 'SSH CONNECTION ERROR',
  SHELL_ERROR: 'SHELL ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  UNEXPECTED_ERROR: 'An unexpected error occurred',
  EXPRESS_APP_CONFIG_ERROR: 'Failed to configure Express app',
  CLIENT_FILE_ERROR: 'Error loading client file',
  FAILED_SESSION_SAVE: 'Failed to save session',
  CONFIG_VALIDATION_ERROR: 'Config validation error',
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  SSH_PORT: 22,
  LISTEN_PORT: 2222,
  SSH_TERM: 'xterm-color',
  IO_PING_TIMEOUT: 60000,
  IO_PING_INTERVAL: 25000,
  IO_PATH: '/ssh/socket.io',
  WEBSSH2_CLIENT_PATH: path.resolve(
    __dirname,
    '..',
    'node_modules',
    'webssh2_client',
    'client',
    'public'
  ),
  CLIENT_FILE: 'client.htm',
  MAX_AUTH_ATTEMPTS: 2,
} as const;

/**
 * HTTP Related
 */
export const HTTP = {
  OK: 200,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  AUTHENTICATE: 'WWW-Authenticate',
  REALM: 'Basic realm="WebSSH2"',
  AUTH_REQUIRED: 'Authentication required.',
  COOKIE: 'basicauth',
  PATH: '/ssh/host/',
  SAMESITE: 'Strict' as const,
  SESSION_SID: 'webssh2_sid',
  CREDENTIALS_CLEARED: 'Credentials cleared.',
} as const;

// Type exports for better type inference
export type MessageKeys = keyof typeof MESSAGES;
export type DefaultKeys = keyof typeof DEFAULTS;
export type HttpKeys = keyof typeof HTTP;