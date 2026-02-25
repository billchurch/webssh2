/**
 * Shared File Service Utilities
 *
 * Common helper functions used by both SftpService and ShellFileService
 * to avoid code duplication in path validation, transfer error mapping,
 * and response construction.
 *
 * @module services/sftp/file-service-shared
 */

import type { TransferId, SessionId } from '../../types/branded.js'
import type { SftpErrorCode, SftpCompleteResponse, SftpDownloadReadyResponse } from '../../types/contracts/v1/sftp.js'
import type { SftpConfig } from '../../types/config.js'
import type { Result } from '../../types/result.js'
import type { SftpServiceError, UploadStartRequest } from './sftp-service.js'
import type { TransferError, StartTransferParams, ManagedTransfer } from './transfer-manager.js'
import { validateFileName, validatePath, type PathValidationOptions } from './path-validator.js'
import { getMimeType, SFTP_ERROR_CODES, SFTP_ERROR_MESSAGES } from '../../constants/sftp.js'
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
 * Validate operation preconditions: enabled check + path validation.
 * Shared by SftpService and ShellFileService setupOperation methods.
 *
 * On success returns the validated/normalized path string.
 */
export function validateOperationPreconditions(
  config: SftpConfig,
  path: string,
  checkExtension: boolean,
  transferId?: TransferId
): Result<string, SftpServiceError> {
  if (!config.enabled) {
    return err({
      code: 'SFTP_NOT_ENABLED',
      message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED],
      transferId
    })
  }

  const pathResult = validatePath(path, getPathValidationOptions(config, checkExtension))
  if (!pathResult.ok) {
    return err({
      code: mapPathErrorCode(pathResult.error.code),
      message: pathResult.error.message,
      path,
      transferId
    })
  }

  return ok(pathResult.value)
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
 * Minimal interface for transfer manager operations used by shared helpers.
 * Avoids importing the full TransferManager class.
 */
interface TransferManagerOps {
  startTransfer(params: StartTransferParams): Result<ManagedTransfer, TransferError>
  activateTransfer(transferId: TransferId): Result<ManagedTransfer, TransferError>
}

/**
 * Start tracking an upload transfer and map errors to SftpServiceError.
 * Shared by SftpService and ShellFileService startUpload methods.
 */
export function startUploadTransfer(
  transferManager: TransferManagerOps,
  request: Pick<UploadStartRequest, 'transferId' | 'sessionId' | 'fileName' | 'fileSize'>,
  resolvedPath: string,
  rateLimitBytesPerSec: number
): Result<ManagedTransfer, SftpServiceError> {
  const result = transferManager.startTransfer({
    transferId: request.transferId,
    sessionId: request.sessionId,
    direction: 'upload',
    remotePath: resolvedPath,
    fileName: request.fileName,
    totalBytes: request.fileSize,
    rateLimitBytesPerSec
  })

  if (!result.ok) {
    return err(mapTransferStartError(result.error, request.transferId))
  }

  return result
}

/**
 * Validate file info and start tracking a download transfer.
 * Performs file-type check, size check, starts the transfer, activates it,
 * and builds the ready response.
 *
 * Shared by SftpService and ShellFileService startDownload methods.
 */
export function validateAndStartDownload(
  transferManager: TransferManagerOps,
  config: Pick<SftpConfig, 'maxFileSize' | 'transferRateLimitBytesPerSec'>,
  request: { readonly transferId: TransferId; readonly sessionId: SessionId },
  resolvedPath: string,
  fileInfo: { readonly type: string; readonly name: string; readonly size: number }
): Result<SftpDownloadReadyResponse, SftpServiceError> {
  if (fileInfo.type !== 'file') {
    return err({
      code: 'SFTP_INVALID_REQUEST',
      message: 'Can only download files',
      path: resolvedPath,
      transferId: request.transferId
    })
  }

  if (fileInfo.size > config.maxFileSize) {
    return err({
      code: 'SFTP_FILE_TOO_LARGE',
      message: `File size ${fileInfo.size} exceeds maximum ${config.maxFileSize}`,
      path: resolvedPath,
      transferId: request.transferId
    })
  }

  const transferResult = transferManager.startTransfer({
    transferId: request.transferId,
    sessionId: request.sessionId,
    direction: 'download',
    remotePath: resolvedPath,
    fileName: fileInfo.name,
    totalBytes: fileInfo.size,
    rateLimitBytesPerSec: config.transferRateLimitBytesPerSec
  })

  if (!transferResult.ok) {
    return err(mapTransferStartError(transferResult.error, request.transferId))
  }

  transferManager.activateTransfer(request.transferId)

  return ok(buildDownloadReadyResponse(request.transferId, fileInfo))
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
