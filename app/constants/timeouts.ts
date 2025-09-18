// Timeout and interval constants
// app/constants/timeouts.ts

export const TIMEOUTS = {
  // SSH connection timeouts
  SSH_READY_TIMEOUT_MS: 20000, // 20 seconds
  SSH_CONNECT_TIMEOUT_MS: 10000, // 10 seconds
  SSH_HANDSHAKE_TIMEOUT_MS: 5000, // 5 seconds
  
  // SSH keepalive
  SSH_KEEPALIVE_INTERVAL_MS: 120000, // 2 minutes
  SSH_KEEPALIVE_COUNT_MAX: 10,
  
  // Session timeouts
  SESSION_IDLE_TIMEOUT_MS: 600000, // 10 minutes
  SESSION_MAX_TIMEOUT_MS: 3600000, // 1 hour
  DEFAULT_IDLE_TIMEOUT_MS: 300000, // 5 minutes
  
  // Socket.IO timeouts
  IO_PING_TIMEOUT_MS: 60000, // 60 seconds
  IO_PING_INTERVAL_MS: 25000, // 25 seconds
  IO_CONNECT_TIMEOUT_MS: 20000, // 20 seconds
  
  // Authentication timeouts
  AUTH_TIMEOUT_MS: 30000, // 30 seconds
  AUTH_RETRY_DELAY_MS: 1000, // 1 second
  
  // Command execution
  EXEC_DEFAULT_TIMEOUT_MS: 30000, // 30 seconds
  EXEC_MAX_TIMEOUT_MS: 3600000, // 1 hour
  
  // Cleanup and garbage collection
  CLEANUP_INTERVAL_MS: 60000, // 1 minute
  STALE_CONNECTION_TIMEOUT_MS: 300000, // 5 minutes
  
  // Retry intervals
  RECONNECT_INTERVAL_MS: 5000, // 5 seconds
  MAX_RECONNECT_ATTEMPTS: 5,
  
  // Buffer flush
  BUFFER_FLUSH_INTERVAL_MS: 100, // 100ms
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
} as const

export const INTERVALS = {
  HEARTBEAT_MS: 30000, // 30 seconds
  METRICS_COLLECTION_MS: 60000, // 1 minute
  LOG_ROTATION_MS: 86400000, // 24 hours
} as const

export type TimeoutKey = keyof typeof TIMEOUTS
export type IntervalKey = keyof typeof INTERVALS