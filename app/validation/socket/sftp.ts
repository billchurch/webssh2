/**
 * SFTP Socket Message Validation
 *
 * Validates incoming SFTP socket messages from the client.
 * Uses pure functions that return Result types for type-safe validation.
 *
 * @module validation/socket/sftp
 */

import type { Result } from '../../types/result.js'
import type {
  SftpListRequest,
  SftpStatRequest,
  SftpMkdirRequest,
  SftpDeleteRequest,
  SftpUploadStartRequest,
  SftpUploadChunkRequest,
  SftpUploadCancelRequest,
  SftpDownloadStartRequest,
  SftpDownloadCancelRequest
} from '../../types/contracts/v1/sftp.js'
import { type TransferId, createTransferId, isTransferId } from '../../types/branded.js'
import { createSafeKey, safeGet, isRecord } from '../../utils/safe-property-access.js'
import { SFTP_LIMITS, SFTP_DEFAULTS } from '../../constants/sftp.js'

// =============================================================================
// Safe Keys for Property Access
// =============================================================================

const PATH_KEY = createSafeKey('path')
const SHOW_HIDDEN_KEY = createSafeKey('showHidden')
const MODE_KEY = createSafeKey('mode')
const RECURSIVE_KEY = createSafeKey('recursive')
const TRANSFER_ID_KEY = createSafeKey('transferId')
const REMOTE_PATH_KEY = createSafeKey('remotePath')
const FILE_NAME_KEY = createSafeKey('fileName')
const FILE_SIZE_KEY = createSafeKey('fileSize')
const MIME_TYPE_KEY = createSafeKey('mimeType')
const OVERWRITE_KEY = createSafeKey('overwrite')
const CHUNK_INDEX_KEY = createSafeKey('chunkIndex')
const DATA_KEY = createSafeKey('data')
const IS_LAST_KEY = createSafeKey('isLast')

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Ensure input is a record
 */
const ensureRecord = (
  value: unknown,
  errorMessage: string
): Result<Record<string, unknown>> => {
  if (!isRecord(value)) {
    return { ok: false, error: new Error(errorMessage) }
  }
  return { ok: true, value }
}

/**
 * Validate required string field
 */
const validateRequiredString = (
  obj: Record<string, unknown>,
  key: ReturnType<typeof createSafeKey>,
  fieldName: string,
  options?: { maxLength?: number; minLength?: number }
): Result<string> => {
  const value = safeGet(obj, key)

  if (value === undefined || value === null) {
    return { ok: false, error: new Error(`${fieldName} is required`) }
  }

  if (typeof value !== 'string') {
    return { ok: false, error: new Error(`${fieldName} must be a string`) }
  }

  const minLength = options?.minLength ?? 1
  if (value.length < minLength) {
    return { ok: false, error: new Error(`${fieldName} must not be empty`) }
  }

  const maxLength = options?.maxLength ?? SFTP_LIMITS.MAX_PATH_LENGTH
  if (value.length > maxLength) {
    return { ok: false, error: new Error(`${fieldName} exceeds maximum length of ${maxLength}`) }
  }

  return { ok: true, value }
}

/**
 * Validate optional string field
 */
const validateOptionalString = (
  obj: Record<string, unknown>,
  key: ReturnType<typeof createSafeKey>,
  fieldName: string,
  options?: { maxLength?: number }
): Result<string | undefined> => {
  const value = safeGet(obj, key)

  if (value === undefined || value === null) {
    return { ok: true, value: undefined }
  }

  if (typeof value !== 'string') {
    return { ok: false, error: new Error(`${fieldName} must be a string`) }
  }

  const maxLength = options?.maxLength ?? SFTP_LIMITS.MAX_PATH_LENGTH
  if (value.length > maxLength) {
    return { ok: false, error: new Error(`${fieldName} exceeds maximum length of ${maxLength}`) }
  }

  return { ok: true, value }
}

/**
 * Validate required integer field
 */
const validateRequiredInt = (
  obj: Record<string, unknown>,
  key: ReturnType<typeof createSafeKey>,
  fieldName: string,
  options?: { min?: number; max?: number }
): Result<number> => {
  const value = safeGet(obj, key)

  if (value === undefined || value === null) {
    return { ok: false, error: new Error(`${fieldName} is required`) }
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: new Error(`${fieldName} must be an integer`) }
  }

  const min = options?.min ?? 0
  const max = options?.max ?? Number.MAX_SAFE_INTEGER
  if (value < min || value > max) {
    return { ok: false, error: new Error(`${fieldName} must be between ${min} and ${max}`) }
  }

  return { ok: true, value }
}

/**
 * Validate optional integer field
 */
const validateOptionalInt = (
  obj: Record<string, unknown>,
  key: ReturnType<typeof createSafeKey>,
  fieldName: string,
  options?: { min?: number; max?: number }
): Result<number | undefined> => {
  const value = safeGet(obj, key)

  if (value === undefined || value === null) {
    return { ok: true, value: undefined }
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { ok: false, error: new Error(`${fieldName} must be an integer`) }
  }

  const min = options?.min ?? 0
  const max = options?.max ?? Number.MAX_SAFE_INTEGER
  if (value < min || value > max) {
    return { ok: false, error: new Error(`${fieldName} must be between ${min} and ${max}`) }
  }

  return { ok: true, value }
}

/**
 * Validate optional boolean field
 */
const validateOptionalBoolean = (
  obj: Record<string, unknown>,
  key: ReturnType<typeof createSafeKey>
): Result<boolean | undefined> => {
  const value = safeGet(obj, key)

  if (value === undefined || value === null) {
    return { ok: true, value: undefined }
  }

  if (typeof value !== 'boolean') {
    return { ok: true, value: undefined }
  }

  return { ok: true, value }
}

/**
 * Validate required boolean field
 */
const validateRequiredBoolean = (
  obj: Record<string, unknown>,
  key: ReturnType<typeof createSafeKey>,
  fieldName: string
): Result<boolean> => {
  const value = safeGet(obj, key)

  if (value === undefined || value === null) {
    return { ok: false, error: new Error(`${fieldName} is required`) }
  }

  if (typeof value !== 'boolean') {
    return { ok: false, error: new Error(`${fieldName} must be a boolean`) }
  }

  return { ok: true, value }
}

/**
 * Validate transfer ID
 */
const validateTransferId = (
  obj: Record<string, unknown>
): Result<TransferId> => {
  const value = safeGet(obj, TRANSFER_ID_KEY)

  if (!isTransferId(value)) {
    return { ok: false, error: new Error('transferId is required and must be a non-empty string') }
  }

  // Validate length for security
  if (value.length > 128) {
    return { ok: false, error: new Error('transferId exceeds maximum length') }
  }

  return { ok: true, value: createTransferId(value) }
}

// =============================================================================
// Request Validators
// =============================================================================

/**
 * Validate sftp-list request
 */
export const validateSftpListRequest = (data: unknown): Result<SftpListRequest> => {
  const recordResult = ensureRecord(data, 'List request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpListRequest>
  }

  const obj = recordResult.value

  const pathResult = validateRequiredString(obj, PATH_KEY, 'path')
  if (!pathResult.ok) {
    return pathResult as Result<SftpListRequest>
  }

  const showHiddenResult = validateOptionalBoolean(obj, SHOW_HIDDEN_KEY)
  if (!showHiddenResult.ok) {
    return showHiddenResult as Result<SftpListRequest>
  }

  const result: SftpListRequest = {
    path: pathResult.value
  }

  if (showHiddenResult.value !== undefined) {
    return { ok: true, value: { ...result, showHidden: showHiddenResult.value } }
  }

  return { ok: true, value: result }
}

/**
 * Validate sftp-stat request
 */
export const validateSftpStatRequest = (data: unknown): Result<SftpStatRequest> => {
  const recordResult = ensureRecord(data, 'Stat request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpStatRequest>
  }

  const obj = recordResult.value

  const pathResult = validateRequiredString(obj, PATH_KEY, 'path')
  if (!pathResult.ok) {
    return pathResult as Result<SftpStatRequest>
  }

  return { ok: true, value: { path: pathResult.value } }
}

/**
 * Validate sftp-mkdir request
 */
export const validateSftpMkdirRequest = (data: unknown): Result<SftpMkdirRequest> => {
  const recordResult = ensureRecord(data, 'Mkdir request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpMkdirRequest>
  }

  const obj = recordResult.value

  const pathResult = validateRequiredString(obj, PATH_KEY, 'path')
  if (!pathResult.ok) {
    return pathResult as Result<SftpMkdirRequest>
  }

  const modeResult = validateOptionalInt(obj, MODE_KEY, 'mode', { min: 0, max: 0o777 })
  if (!modeResult.ok) {
    return modeResult as Result<SftpMkdirRequest>
  }

  const result: SftpMkdirRequest = {
    path: pathResult.value
  }

  if (modeResult.value !== undefined) {
    return { ok: true, value: { ...result, mode: modeResult.value } }
  }

  return { ok: true, value: result }
}

/**
 * Validate sftp-delete request
 */
export const validateSftpDeleteRequest = (data: unknown): Result<SftpDeleteRequest> => {
  const recordResult = ensureRecord(data, 'Delete request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpDeleteRequest>
  }

  const obj = recordResult.value

  const pathResult = validateRequiredString(obj, PATH_KEY, 'path')
  if (!pathResult.ok) {
    return pathResult as Result<SftpDeleteRequest>
  }

  const recursiveResult = validateOptionalBoolean(obj, RECURSIVE_KEY)
  if (!recursiveResult.ok) {
    return recursiveResult as Result<SftpDeleteRequest>
  }

  const result: SftpDeleteRequest = {
    path: pathResult.value
  }

  if (recursiveResult.value !== undefined) {
    return { ok: true, value: { ...result, recursive: recursiveResult.value } }
  }

  return { ok: true, value: result }
}

/**
 * Options for upload start request validation
 */
export interface UploadStartValidationOptions {
  /** Maximum file size allowed (from config). Defaults to SFTP_DEFAULTS.MAX_FILE_SIZE */
  maxFileSize?: number | undefined
}

/**
 * Validate sftp-upload-start request
 *
 * Note: transferId is NOT validated here - it is generated server-side.
 * Any client-provided transferId is ignored.
 */
export const validateSftpUploadStartRequest = (
  data: unknown,
  options?: UploadStartValidationOptions
): Result<SftpUploadStartRequest> => {
  const recordResult = ensureRecord(data, 'Upload start request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpUploadStartRequest>
  }

  const obj = recordResult.value

  // Note: transferId is NOT validated - server generates it

  const remotePathResult = validateRequiredString(obj, REMOTE_PATH_KEY, 'remotePath')
  if (!remotePathResult.ok) {
    return remotePathResult as Result<SftpUploadStartRequest>
  }

  const fileNameResult = validateRequiredString(obj, FILE_NAME_KEY, 'fileName', {
    maxLength: 255
  })
  if (!fileNameResult.ok) {
    return fileNameResult as Result<SftpUploadStartRequest>
  }

  const maxFileSize = options?.maxFileSize ?? SFTP_DEFAULTS.MAX_FILE_SIZE
  const fileSizeResult = validateRequiredInt(obj, FILE_SIZE_KEY, 'fileSize', {
    min: 0,
    max: maxFileSize
  })
  if (!fileSizeResult.ok) {
    return fileSizeResult as Result<SftpUploadStartRequest>
  }

  const mimeTypeResult = validateOptionalString(obj, MIME_TYPE_KEY, 'mimeType', {
    maxLength: 128
  })
  if (!mimeTypeResult.ok) {
    return mimeTypeResult as Result<SftpUploadStartRequest>
  }

  const overwriteResult = validateOptionalBoolean(obj, OVERWRITE_KEY)
  if (!overwriteResult.ok) {
    return overwriteResult as Result<SftpUploadStartRequest>
  }

  // Build object directly - spread undefined optionals are dropped
  const mimeType = mimeTypeResult.value
  const overwrite = overwriteResult.value

  // Construct result based on which optional fields are present
  if (mimeType !== undefined && overwrite !== undefined) {
    return {
      ok: true,
      value: {
        remotePath: remotePathResult.value,
        fileName: fileNameResult.value,
        fileSize: fileSizeResult.value,
        mimeType,
        overwrite
      }
    }
  }

  if (mimeType !== undefined) {
    return {
      ok: true,
      value: {
        remotePath: remotePathResult.value,
        fileName: fileNameResult.value,
        fileSize: fileSizeResult.value,
        mimeType
      }
    }
  }

  if (overwrite !== undefined) {
    return {
      ok: true,
      value: {
        remotePath: remotePathResult.value,
        fileName: fileNameResult.value,
        fileSize: fileSizeResult.value,
        overwrite
      }
    }
  }

  return {
    ok: true,
    value: {
      remotePath: remotePathResult.value,
      fileName: fileNameResult.value,
      fileSize: fileSizeResult.value
    }
  }
}

/**
 * Validate sftp-upload-chunk request
 */
export const validateSftpUploadChunkRequest = (data: unknown): Result<SftpUploadChunkRequest> => {
  const recordResult = ensureRecord(data, 'Upload chunk request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpUploadChunkRequest>
  }

  const obj = recordResult.value

  const transferIdResult = validateTransferId(obj)
  if (!transferIdResult.ok) {
    return transferIdResult as Result<SftpUploadChunkRequest>
  }

  const chunkIndexResult = validateRequiredInt(obj, CHUNK_INDEX_KEY, 'chunkIndex', {
    min: 0,
    max: 1_000_000 // Reasonable upper limit for chunk count
  })
  if (!chunkIndexResult.ok) {
    return chunkIndexResult as Result<SftpUploadChunkRequest>
  }

  // Data is base64 encoded, max size is ~1.33x the binary chunk size
  const maxDataLength = Math.ceil(SFTP_DEFAULTS.CHUNK_SIZE * 1.34) + 100
  const dataResult = validateRequiredString(obj, DATA_KEY, 'data', {
    maxLength: maxDataLength,
    minLength: 0
  })
  if (!dataResult.ok) {
    return dataResult as Result<SftpUploadChunkRequest>
  }

  const isLastResult = validateRequiredBoolean(obj, IS_LAST_KEY, 'isLast')
  if (!isLastResult.ok) {
    return isLastResult as Result<SftpUploadChunkRequest>
  }

  return {
    ok: true,
    value: {
      transferId: transferIdResult.value,
      chunkIndex: chunkIndexResult.value,
      data: dataResult.value,
      isLast: isLastResult.value
    }
  }
}

/**
 * Validate sftp-upload-cancel request
 */
export const validateSftpUploadCancelRequest = (
  data: unknown
): Result<SftpUploadCancelRequest> => {
  const recordResult = ensureRecord(data, 'Upload cancel request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpUploadCancelRequest>
  }

  const obj = recordResult.value

  const transferIdResult = validateTransferId(obj)
  if (!transferIdResult.ok) {
    return transferIdResult as Result<SftpUploadCancelRequest>
  }

  return { ok: true, value: { transferId: transferIdResult.value } }
}

/**
 * Validate sftp-download-start request
 *
 * Note: transferId is NOT validated here - it is generated server-side.
 * Any client-provided transferId is ignored.
 */
export const validateSftpDownloadStartRequest = (
  data: unknown
): Result<SftpDownloadStartRequest> => {
  const recordResult = ensureRecord(data, 'Download start request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpDownloadStartRequest>
  }

  const obj = recordResult.value

  // Note: transferId is NOT validated - server generates it

  const remotePathResult = validateRequiredString(obj, REMOTE_PATH_KEY, 'remotePath')
  if (!remotePathResult.ok) {
    return remotePathResult as Result<SftpDownloadStartRequest>
  }

  return {
    ok: true,
    value: {
      remotePath: remotePathResult.value
    }
  }
}

/**
 * Validate sftp-download-cancel request
 */
export const validateSftpDownloadCancelRequest = (
  data: unknown
): Result<SftpDownloadCancelRequest> => {
  const recordResult = ensureRecord(data, 'Download cancel request must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<SftpDownloadCancelRequest>
  }

  const obj = recordResult.value

  const transferIdResult = validateTransferId(obj)
  if (!transferIdResult.ok) {
    return transferIdResult as Result<SftpDownloadCancelRequest>
  }

  return { ok: true, value: { transferId: transferIdResult.value } }
}
