/**
 * Shared File Service Utilities
 *
 * Common helper functions used by both SftpService and ShellFileService
 * to avoid code duplication in path validation and transfer error mapping.
 *
 * @module services/sftp/file-service-shared
 */

import type { TransferId } from '../../types/branded.js'
import type { SftpErrorCode } from '../../types/contracts/v1/sftp.js'
import type { SftpConfig } from '../../types/config.js'
import type { SftpServiceError } from './sftp-service.js'
import type { TransferError } from './transfer-manager.js'
import type { PathValidationOptions } from './path-validator.js'

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
