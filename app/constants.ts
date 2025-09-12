// server
// app/constants.ts

import { fileURLToPath } from 'url'
import path, { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
} as const

export const DEFAULTS = {
  SSH_PORT: 22,
  LISTEN_PORT: 2222,
  SSH_TERM: 'xterm-color',
  TERM_ROWS: 24,
  TERM_COLS: 80,
  IO_PING_TIMEOUT_MS: 60_000,
  IO_PING_INTERVAL_MS: 25_000,
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
  SSH_READY_TIMEOUT_MS: 20_000,
  SSH_KEEPALIVE_INTERVAL_MS: 120_000,
  SSH_KEEPALIVE_COUNT_MAX: 10,
  HSTS_MAX_AGE_SECONDS: 31_536_000,
  SESSION_COOKIE_NAME: 'webssh2.sid',
  SSO_HEADERS: {
    USERNAME: 'x-apm-username',
    PASSWORD: 'x-apm-password',
    SESSION: 'x-apm-session',
  },
} as const

export const ENV_LIMITS = {
  MAX_PAIRS: 50,
  MAX_KEY_LENGTH: 32,
  MAX_VALUE_LENGTH: 512,
} as const

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
  SAMESITE_POLICY: 'Strict',
  SESSION_SID: 'webssh2_sid',
  CREDENTIALS_CLEARED: 'Credentials cleared.',
} as const

export const HEADERS = {
  CONTENT_SECURITY_POLICY: 'Content-Security-Policy',
  X_CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  X_FRAME_OPTIONS: 'X-Frame-Options',
  X_XSS_PROTECTION: 'X-XSS-Protection',
  REFERRER_POLICY: 'Referrer-Policy',
  PERMISSIONS_POLICY: 'Permissions-Policy',
  STRICT_TRANSPORT_SECURITY: 'Strict-Transport-Security',
} as const
