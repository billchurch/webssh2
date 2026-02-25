/**
 * Shared File Service Utilities
 *
 * Common helper functions used by both SftpService and ShellFileService
 * to avoid code duplication in path validation, transfer error mapping,
 * and response construction.
 *
 * @module services/sftp/file-service-shared
 */

import type { TransferId } from '../../types/branded.js'
import type { SftpErrorCode, SftpCompleteResponse, SftpDownloadReadyResponse } from '../../types/contracts/v1/sftp.js'
import type { SftpConfig } from '../../types/config.js'
import type { Result } from '../../types/result.js'
import type { SftpServiceError, UploadStartRequest } from './sftp-service.js'
import type { TransferError } from './transfer-manager.js'
import { validateFileName, type PathValidationOptions } from './path-validator.js'
import { getMimeType } from '../../constants/sftp.js'
import { ok, err } from '../../utils/result.js'

/**
 * Map path validation error code to SFTP service error code
 */
export function mapPathErrorCode(code: string): SftpErrorCode {
  switch (code) {
    case 'EXTENSION_BLOCKED':
      return 'SFTP_EXTENSION_BLOCKED'
    case 'PATH_FORBIDDEN':
      return 'SFTP_PATH_FORBIDDEN'
    default:
      return 'SFTP_INVALID_REQUEST'
  }
}

/**
 * Build PathValidationOptions from SFTP config
 */
export function getPathValidationOptions(
  config: SftpConfig,
  checkExtension: boolean
): PathValidationOptions {
  return {
    allowedPaths: config.allowedPaths,
    blockedExtensions: config.blockedExtensions,
    checkExtension
  }
}

/**
 * Map a transfer start error to an SFTP service error
 */
export function mapTransferStartError(
  error: TransferError,
  transferId: TransferId
): SftpServiceError {
  return {
    code: error.code === 'MAX_TRANSFERS' ? 'SFTP_MAX_TRANSFERS' : 'SFTP_INVALID_REQUEST',
    message: error.message,
    transferId
  }
}

/**
 * Validate upload pre-flight checks: file size and filename.
 * Returns the first validation error, or ok(undefined) if valid.
 */
export function validateUploadPreFlight(
  request: Pick<UploadStartRequest, 'fileSize' | 'fileName' | 'transferId'>,
  maxFileSize: number
): Result<void, SftpServiceError> {
  if (request.fileSize > maxFileSize) {
    return err({
      code: 'SFTP_FILE_TOO_LARGE',
      message: `File size ${request.fileSize} exceeds maximum ${maxFileSize}`,
      transferId: request.transferId
    })
  }

  const fileNameResult = validateFileName(request.fileName)
  if (!fileNameResult.ok) {
    return err({
      code: 'SFTP_INVALID_REQUEST',
      message: fileNameResult.error.message,
      transferId: request.transferId
    })
  }

  return ok(undefined)
}

/**
 * Map a chunk update/progress error to an SFTP service error
 */
export function mapChunkUpdateError(
  error: TransferError,
  transferId: TransferId
): SftpServiceError {
  return {
    code: error.code === 'CHUNK_MISMATCH' ? 'SFTP_CHUNK_ERROR' : 'SFTP_INVALID_REQUEST',
    message: error.message,
    transferId
  }
}

/**
 * Build a transfer complete response from transfer stats
 */
export function buildCompleteResponse(
  transferId: TransferId,
  direction: 'upload' | 'download',
  stats: { bytesTransferred: number; durationMs: number; averageBytesPerSecond: number }
): SftpCompleteResponse {
  return {
    transferId,
    direction,
    bytesTransferred: stats.bytesTransferred,
    durationMs: stats.durationMs,
    averageBytesPerSecond: stats.averageBytesPerSecond
  }
}

/**
 * Build a download ready response from file info
 */
export function buildDownloadReadyResponse(
  transferId: TransferId,
  fileInfo: { name: string; size: number }
): SftpDownloadReadyResponse {
  return {
    transferId,
    fileName: fileInfo.name,
    fileSize: fileInfo.size,
    mimeType: getMimeType(fileInfo.name)
  }
}
