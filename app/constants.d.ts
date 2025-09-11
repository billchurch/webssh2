export const MESSAGES: {
  INVALID_CREDENTIALS: string
  SSH_CONNECTION_ERROR: string
  SHELL_ERROR: string
  CONFIG_ERROR: string
  UNEXPECTED_ERROR: string
  EXPRESS_APP_CONFIG_ERROR: string
  CLIENT_FILE_ERROR: string
  FAILED_SESSION_SAVE: string
  CONFIG_VALIDATION_ERROR: string
}

export const DEFAULTS: {
  SSH_PORT: number
  LISTEN_PORT: number
  SSH_TERM: string
  IO_PING_TIMEOUT: number
  IO_PING_INTERVAL: number
  IO_PATH: string
  WEBSSH2_CLIENT_PATH: string
  CLIENT_FILE: string
  MAX_AUTH_ATTEMPTS: number
}

export const HTTP: {
  OK: number
  UNAUTHORIZED: number
  FORBIDDEN: number
  INTERNAL_SERVER_ERROR: number
  AUTHENTICATE: string
  REALM: string
  AUTH_REQUIRED: string
  COOKIE: string
  PATH: string
  SAMESITE: string
  SESSION_SID: string
  CREDENTIALS_CLEARED: string
}
