// Validation limits and messages
// app/constants/validation.ts

export const VALIDATION_LIMITS = {
  // Terminal dimensions
  MIN_TERMINAL_COLS: 1,
  MAX_TERMINAL_COLS: 1000,
  MIN_TERMINAL_ROWS: 1,
  MAX_TERMINAL_ROWS: 1000,
  MAX_TERMINAL_DIMENSION: 9999,
  
  // Command execution
  MAX_EXEC_TIMEOUT_MS: 3600000, // 1 hour
  MIN_EXEC_TIMEOUT_MS: 0,
  
  // Environment variables
  MAX_ENV_PAIRS: 50,
  MAX_ENV_KEY_LENGTH: 256,
  MAX_ENV_VALUE_LENGTH: 10000,
  MAX_ENV_VAR_NAME_LENGTH: 255,
  
  // Session
  MAX_SESSION_TIMEOUT_MS: 300000, // 5 minutes
  MAX_SESSION_HISTORY_SIZE: 100,
  
  // String lengths
  MAX_USERNAME_LENGTH: 256,
  MAX_HOSTNAME_LENGTH: 256,
  MAX_COMMAND_LENGTH: 65536,
  MAX_TERMINAL_TYPE_LENGTH: 64,
  MAX_PATH_LENGTH: 4096,
  
  // Port numbers
  MIN_PORT: 1,
  MAX_PORT: 65535,
} as const

export const VALIDATION_MESSAGES = {
  // Required field messages
  USERNAME_REQUIRED: 'Username is required',
  HOST_REQUIRED: 'Host is required',
  COMMAND_REQUIRED: 'Command is required',
  AUTH_METHOD_REQUIRED: 'Either password or private key is required',
  
  // Invalid value messages
  INVALID_TERMINAL_TYPE: 'Invalid terminal type',
  INVALID_COLUMNS_VALUE: 'Invalid columns value',
  INVALID_ROWS_VALUE: 'Invalid rows value',
  INVALID_TIMEOUT_VALUE: 'Invalid timeout value',
  INVALID_PORT_NUMBER: 'Invalid port number',
  INVALID_CREDENTIALS: 'Invalid credentials format',
  
  // Type validation messages
  TERMINAL_TYPE_STRING_ERROR: 'Terminal type must be a string',
  PTY_FLAG_BOOLEAN_ERROR: 'PTY flag must be boolean',
  COLS_NUMBER_ERROR: 'Columns must be a number',
  ROWS_NUMBER_ERROR: 'Rows must be a number',
  PORT_NUMBER_ERROR: 'Port must be a number',
  TIMEOUT_NUMBER_ERROR: 'Timeout must be a number',
  
  // Range validation messages
  COLS_OUT_OF_RANGE: 'Columns value out of range',
  ROWS_OUT_OF_RANGE: 'Rows value out of range',
  PORT_OUT_OF_RANGE: 'Port must be between 1 and 65535',
  TIMEOUT_EXCEEDED: 'Timeout value exceeds maximum allowed',
  
  // Environment variable messages
  ENV_KEY_TOO_LONG: 'Environment variable name too long',
  ENV_VALUE_TOO_LONG: 'Environment variable value too long',
  TOO_MANY_ENV_VARS: 'Too many environment variables',
  INVALID_ENV_VAR_NAME: 'Invalid environment variable name',
  
  // Connection messages
  SSH_CONNECTION_FAILED: 'SSH connection failed',
  AUTHENTICATION_FAILED: 'Authentication failed',
  CONNECTION_CLOSED: 'Connection closed',
  NO_SSH_CONNECTION: 'No SSH connection',
  NO_ACTIVE_TERMINAL: 'No active terminal to receive replayed credentials',
  AUTH_METHOD_DISABLED: 'Authentication method disabled by server policy',
  
  // Configuration messages
  REPLAY_DISABLED: 'Replay disabled by server configuration',
  NO_REPLAY_PASSWORD: 'No password available to replay', //NOSONAR
  CONFIG_VALIDATION_ERROR: 'Config validation error',
  SESSION_CREDENTIALS_CLEARED: 'Session credentials cleared due to network error',
} as const

export type ValidationMessage = typeof VALIDATION_MESSAGES[keyof typeof VALIDATION_MESSAGES]
