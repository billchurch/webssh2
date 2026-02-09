/**
 * SFTP Constants
 *
 * Default configuration values, error codes, and limits for SFTP operations.
 *
 * @module constants/sftp
 */

// =============================================================================
// Default Configuration Values
// =============================================================================

/**
 * SFTP default configuration
 */
export const SFTP_DEFAULTS = {
  /** Default backend for file operations */
  BACKEND: 'sftp' as const,

  /** Whether SFTP is enabled by default */
  ENABLED: false,

  /** Maximum file size in bytes (100MB) */
  MAX_FILE_SIZE: 104_857_600,

  /** Transfer rate limit in bytes per second (0 = unlimited) */
  TRANSFER_RATE_LIMIT_BYTES_PER_SEC: 0,

  /** Chunk size for transfers in bytes (32KB) */
  CHUNK_SIZE: 32_768,

  /** Maximum concurrent transfers per session */
  MAX_CONCURRENT_TRANSFERS: 2,

  /** Operation timeout in milliseconds */
  TIMEOUT: 30_000,

  /** Default directory permissions for mkdir */
  DEFAULT_DIR_MODE: 0o755,

  /** Progress update interval in milliseconds */
  PROGRESS_INTERVAL_MS: 250,

  /** Idle timeout for SFTP sessions in milliseconds (5 minutes) */
  SESSION_IDLE_TIMEOUT_MS: 300_000,

  /**
   * Number of concurrent read requests for parallel downloads.
   * Higher values hide network latency better but use more memory.
   * Similar to SSH2's fastGet concurrency parameter.
   */
  DOWNLOAD_CONCURRENCY: 32,
} as const

/**
 * SFTP limits
 */
export const SFTP_LIMITS = {
  /** Minimum chunk size (1KB) */
  MIN_CHUNK_SIZE: 1024,

  /** Maximum chunk size (1MB) */
  MAX_CHUNK_SIZE: 1_048_576,

  /** Maximum path length */
  MAX_PATH_LENGTH: 4096,

  /** Maximum filename length */
  MAX_FILENAME_LENGTH: 255,

  /** Maximum entries to return from directory listing */
  MAX_DIRECTORY_ENTRIES: 10_000,

  /** Maximum concurrent SFTP sessions per SSH connection */
  MAX_SESSIONS_PER_CONNECTION: 1,
} as const

// =============================================================================
// Socket Event Names
// =============================================================================

/**
 * SFTP socket event names
 */
export const SFTP_EVENTS = {
  // Client → Server
  LIST: 'sftp-list',
  STAT: 'sftp-stat',
  MKDIR: 'sftp-mkdir',
  DELETE: 'sftp-delete',
  UPLOAD_START: 'sftp-upload-start',
  UPLOAD_CHUNK: 'sftp-upload-chunk',
  UPLOAD_CANCEL: 'sftp-upload-cancel',
  DOWNLOAD_START: 'sftp-download-start',
  DOWNLOAD_CANCEL: 'sftp-download-cancel',

  // Server → Client
  DIRECTORY: 'sftp-directory',
  STAT_RESULT: 'sftp-stat-result',
  OPERATION_RESULT: 'sftp-operation-result',
  UPLOAD_READY: 'sftp-upload-ready',
  UPLOAD_ACK: 'sftp-upload-ack',
  DOWNLOAD_READY: 'sftp-download-ready',
  DOWNLOAD_CHUNK: 'sftp-download-chunk',
  PROGRESS: 'sftp-progress',
  COMPLETE: 'sftp-complete',
  ERROR: 'sftp-error',
} as const

export type SftpEventType = (typeof SFTP_EVENTS)[keyof typeof SFTP_EVENTS]

// =============================================================================
// Error Codes
// =============================================================================

/**
 * SFTP error code constants
 */
export const SFTP_ERROR_CODES = {
  NOT_ENABLED: 'SFTP_NOT_ENABLED',
  NO_CONNECTION: 'SFTP_NO_CONNECTION',
  SESSION_ERROR: 'SFTP_SESSION_ERROR',
  NOT_FOUND: 'SFTP_NOT_FOUND',
  PERMISSION_DENIED: 'SFTP_PERMISSION_DENIED',
  PATH_FORBIDDEN: 'SFTP_PATH_FORBIDDEN',
  EXTENSION_BLOCKED: 'SFTP_EXTENSION_BLOCKED',
  FILE_TOO_LARGE: 'SFTP_FILE_TOO_LARGE',
  ALREADY_EXISTS: 'SFTP_ALREADY_EXISTS',
  TRANSFER_CANCELLED: 'SFTP_TRANSFER_CANCELLED',
  RATE_LIMITED: 'SFTP_RATE_LIMITED',
  MAX_TRANSFERS: 'SFTP_MAX_TRANSFERS',
  CHUNK_ERROR: 'SFTP_CHUNK_ERROR',
  TIMEOUT: 'SFTP_TIMEOUT',
  INVALID_REQUEST: 'SFTP_INVALID_REQUEST',
} as const

export type SftpErrorCodeType = (typeof SFTP_ERROR_CODES)[keyof typeof SFTP_ERROR_CODES]

// =============================================================================
// Error Messages
// =============================================================================

/**
 * Human-readable error messages for SFTP error codes
 */
export const SFTP_ERROR_MESSAGES: Record<SftpErrorCodeType, string> = {
  [SFTP_ERROR_CODES.NOT_ENABLED]: 'SFTP feature is disabled',
  [SFTP_ERROR_CODES.NO_CONNECTION]: 'No active SSH connection',
  [SFTP_ERROR_CODES.SESSION_ERROR]: 'Failed to open SFTP session',
  [SFTP_ERROR_CODES.NOT_FOUND]: 'File or directory not found',
  [SFTP_ERROR_CODES.PERMISSION_DENIED]: 'Permission denied',
  [SFTP_ERROR_CODES.PATH_FORBIDDEN]: 'Path not in allowed directories',
  [SFTP_ERROR_CODES.EXTENSION_BLOCKED]: 'File extension not allowed',
  [SFTP_ERROR_CODES.FILE_TOO_LARGE]: 'File exceeds maximum size limit',
  [SFTP_ERROR_CODES.ALREADY_EXISTS]: 'File already exists',
  [SFTP_ERROR_CODES.TRANSFER_CANCELLED]: 'Transfer was cancelled',
  [SFTP_ERROR_CODES.RATE_LIMITED]: 'Transfer rate limited',
  [SFTP_ERROR_CODES.MAX_TRANSFERS]: 'Maximum concurrent transfers reached',
  [SFTP_ERROR_CODES.CHUNK_ERROR]: 'Failed to process chunk',
  [SFTP_ERROR_CODES.TIMEOUT]: 'Operation timed out',
  [SFTP_ERROR_CODES.INVALID_REQUEST]: 'Invalid request',
}

// =============================================================================
// File Type Detection
// =============================================================================

/**
 * Common MIME types by extension (using Map for safe lookup)
 */
export const MIME_TYPES: ReadonlyMap<string, string> = new Map([
  // Text
  ['.txt', 'text/plain'],
  ['.html', 'text/html'],
  ['.htm', 'text/html'],
  ['.css', 'text/css'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.xml', 'application/xml'],
  ['.csv', 'text/csv'],
  ['.md', 'text/markdown'],
  ['.yaml', 'text/yaml'],
  ['.yml', 'text/yaml'],

  // Images
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],

  // Archives
  ['.zip', 'application/zip'],
  ['.gz', 'application/gzip'],
  ['.tar', 'application/x-tar'],
  ['.tgz', 'application/gzip'],
  ['.7z', 'application/x-7z-compressed'],
  ['.rar', 'application/vnd.rar'],

  // Documents
  ['.pdf', 'application/pdf'],
  ['.doc', 'application/msword'],
  ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['.xls', 'application/vnd.ms-excel'],
  ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],

  // Binary
  ['.bin', 'application/octet-stream'],
  ['.exe', 'application/octet-stream'],
  ['.dll', 'application/octet-stream'],
  ['.so', 'application/octet-stream'],

  // Scripts
  ['.sh', 'application/x-sh'],
  ['.bash', 'application/x-sh'],
  ['.py', 'text/x-python'],
  ['.rb', 'text/x-ruby'],
  ['.php', 'text/x-php'],
  ['.ts', 'text/typescript'],
  ['.tsx', 'text/typescript'],
])

/**
 * Default MIME type for unknown extensions
 */
export const DEFAULT_MIME_TYPE = 'application/octet-stream'

/**
 * Get MIME type from filename
 */
export function getMimeType(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) {
    return DEFAULT_MIME_TYPE
  }

  const ext = filename.slice(dotIndex).toLowerCase()
  return MIME_TYPES.get(ext) ?? DEFAULT_MIME_TYPE
}
