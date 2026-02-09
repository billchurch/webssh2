/**
 * SFTP Socket Adapter
 *
 * Handles SFTP socket events by bridging between Socket.IO messages
 * and the SFTP service layer.
 *
 * @module socket/adapters/service-socket-sftp
 */

import type { AdapterContext } from './service-socket-shared.js'
import {
  type ConnectionId,
  type SessionId,
  type TransferId,
  createConnectionId,
  createSessionId,
  generateTransferId
} from '../../types/branded.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import {
  validateSftpListRequest,
  validateSftpStatRequest,
  validateSftpMkdirRequest,
  validateSftpDeleteRequest,
  validateSftpUploadStartRequest,
  validateSftpUploadChunkRequest,
  validateSftpUploadCancelRequest,
  validateSftpDownloadStartRequest,
  validateSftpDownloadCancelRequest
} from '../../validation/socket/sftp.js'
import type { SftpOperation } from '../../types/contracts/v1/sftp.js'
import { emitSocketLog } from '../../logging/socket-logger.js'
import type { FileService } from '../../services/sftp/file-service.js'
import type {
  SftpServiceError,
  DownloadStreamCallbacks
} from '../../services/sftp/sftp-service.js'

/**
 * SFTP Socket Adapter
 *
 * Responsible for:
 * - Validating incoming SFTP socket messages
 * - Converting between socket messages and service calls
 * - Emitting appropriate responses/errors back to client
 * - Logging SFTP operations
 */
export class ServiceSocketSftp {
  constructor(private readonly context: AdapterContext) {}

  /**
   * Handle sftp-list event
   */
  async handleList(data: unknown): Promise<void> {
    const startTime = Date.now()

    if (!this.ensureSftpEnabled()) {
      return
    }

    const validation = validateSftpListRequest(data)
    if (!validation.ok) {
      this.emitValidationError('list', validation.error.message)
      return
    }

    const request = validation.value
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      this.emitNoConnectionError('list')
      return
    }

    const sftp = this.getSftpService()
    if (sftp === undefined) {
      this.emitNotEnabledError('list')
      return
    }

    const result = await sftp.listDirectory(
      ids.connectionId,
      ids.sessionId,
      request.path,
      request.showHidden ?? false
    )

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_DIRECTORY, result.value)
      this.logSftpOperation('list', 'success', Date.now() - startTime, { path: request.path })
    } else {
      this.emitSftpError('list', result.error)
      this.logSftpOperation('list', 'failure', Date.now() - startTime, {
        path: request.path,
        error: result.error.code
      })
    }
  }

  /**
   * Handle sftp-stat event
   */
  async handleStat(data: unknown): Promise<void> {
    const startTime = Date.now()

    if (!this.ensureSftpEnabled()) {
      return
    }

    const validation = validateSftpStatRequest(data)
    if (!validation.ok) {
      this.emitValidationError('stat', validation.error.message)
      return
    }

    const request = validation.value
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      this.emitNoConnectionError('stat')
      return
    }

    const sftp = this.getSftpService()
    if (sftp === undefined) {
      this.emitNotEnabledError('stat')
      return
    }

    const result = await sftp.stat(ids.connectionId, ids.sessionId, request.path)

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_STAT_RESULT, result.value)
      this.logSftpOperation('stat', 'success', Date.now() - startTime, { path: request.path })
    } else {
      this.emitSftpError('stat', result.error)
      this.logSftpOperation('stat', 'failure', Date.now() - startTime, {
        path: request.path,
        error: result.error.code
      })
    }
  }

  /**
   * Handle sftp-mkdir event
   */
  async handleMkdir(data: unknown): Promise<void> {
    const startTime = Date.now()

    if (!this.ensureSftpEnabled()) {
      return
    }

    const validation = validateSftpMkdirRequest(data)
    if (!validation.ok) {
      this.emitValidationError('mkdir', validation.error.message)
      return
    }

    const request = validation.value
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      this.emitNoConnectionError('mkdir')
      return
    }

    const sftp = this.getSftpService()
    if (sftp === undefined) {
      this.emitNotEnabledError('mkdir')
      return
    }

    const result = await sftp.mkdir(ids.connectionId, ids.sessionId, request.path, request.mode)

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_OPERATION_RESULT, result.value)
      this.logSftpOperation('mkdir', 'success', Date.now() - startTime, { path: request.path })
    } else {
      this.emitSftpError('mkdir', result.error)
      this.logSftpOperation('mkdir', 'failure', Date.now() - startTime, {
        path: request.path,
        error: result.error.code
      })
    }
  }

  /**
   * Handle sftp-delete event
   */
  async handleDelete(data: unknown): Promise<void> {
    const startTime = Date.now()

    if (!this.ensureSftpEnabled()) {
      return
    }

    const validation = validateSftpDeleteRequest(data)
    if (!validation.ok) {
      this.emitValidationError('delete', validation.error.message)
      return
    }

    const request = validation.value
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      this.emitNoConnectionError('delete')
      return
    }

    const sftp = this.getSftpService()
    if (sftp === undefined) {
      this.emitNotEnabledError('delete')
      return
    }

    const result = await sftp.delete(
      ids.connectionId,
      ids.sessionId,
      request.path,
      request.recursive ?? false
    )

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_OPERATION_RESULT, result.value)
      this.logSftpOperation('delete', 'success', Date.now() - startTime, { path: request.path })
    } else {
      this.emitSftpError('delete', result.error)
      this.logSftpOperation('delete', 'failure', Date.now() - startTime, {
        path: request.path,
        error: result.error.code
      })
    }
  }

  /**
   * Handle sftp-upload-start event
   *
   * Server generates the transferId and returns it in the response.
   * This ensures proper ownership tracking and prevents authorization bypass.
   */
  async handleUploadStart(data: unknown): Promise<void> {
    const startTime = Date.now()

    if (!this.ensureSftpEnabled()) {
      return
    }

    // Get configured max file size for validation
    const maxFileSize = this.context.config.ssh.sftp?.maxFileSize
    const validation = validateSftpUploadStartRequest(data, { maxFileSize })
    if (!validation.ok) {
      this.emitValidationError('upload', validation.error.message)
      return
    }

    const request = validation.value
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      this.emitNoConnectionError('upload')
      return
    }

    const sftp = this.getSftpService()
    if (sftp === undefined) {
      this.emitNotEnabledError('upload')
      return
    }

    // SERVER generates the transferId (security: prevents authorization bypass)
    const transferId = generateTransferId()

    // Build upload request, conditionally adding optional fields
    const uploadRequest: Parameters<typeof sftp.startUpload>[0] = {
      transferId,
      sessionId: ids.sessionId,
      connectionId: ids.connectionId,
      remotePath: request.remotePath,
      fileName: request.fileName,
      fileSize: request.fileSize
    }

    if (request.mimeType !== undefined) {
      (uploadRequest as { mimeType?: string }).mimeType = request.mimeType
    }

    if (request.overwrite !== undefined) {
      (uploadRequest as { overwrite?: boolean }).overwrite = request.overwrite
    }

    const result = await sftp.startUpload(uploadRequest)

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_UPLOAD_READY, result.value)
      this.logSftpOperation('upload_start', 'success', Date.now() - startTime, {
        transferId,
        fileName: request.fileName,
        fileSize: request.fileSize
      })
    } else {
      this.emitSftpError('upload', result.error)
      this.logSftpOperation('upload_start', 'failure', Date.now() - startTime, {
        transferId,
        error: result.error.code
      })
    }
  }

  /**
   * Handle sftp-upload-chunk event
   *
   * SECURITY: Verifies that the requesting session owns the transfer
   * before processing the chunk to prevent authorization bypass attacks.
   */
  async handleUploadChunk(data: unknown): Promise<void> {
    const validation = validateSftpUploadChunkRequest(data)
    if (!validation.ok) {
      this.emitValidationError('upload', validation.error.message)
      return
    }

    const request = validation.value
    const sftp = this.getSftpService()
    if (sftp === undefined) {
      this.emitNotEnabledError('upload', request.transferId)
      return
    }

    // Get session IDs for ownership verification
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      this.emitNoConnectionError('upload', request.transferId)
      return
    }

    // SECURITY: Verify ownership before processing chunk
    const ownershipResult = sftp.verifyTransferOwnership(request.transferId, ids.sessionId)
    if (!ownershipResult.ok) {
      // Log authorization rejection for security audit
      this.logAuthorizationRejection('upload_chunk', request.transferId, ids.sessionId)
      // Return vague "not found" error to prevent enumeration
      this.emitSftpError('upload', {
        code: 'SFTP_NOT_FOUND',
        message: 'Transfer not found',
        transferId: request.transferId
      })
      return
    }

    // Decode base64 data
    const dataBuffer = Buffer.from(request.data, 'base64')

    const result = await sftp.processUploadChunk({
      transferId: request.transferId,
      chunkIndex: request.chunkIndex,
      data: dataBuffer,
      isLast: request.isLast
    })

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_UPLOAD_ACK, result.value)

      // If this was the last chunk, send completion
      if (request.isLast) {
        const completeResult = sftp.completeUpload(request.transferId)
        if (completeResult.ok) {
          this.context.socket.emit(SOCKET_EVENTS.SFTP_COMPLETE, completeResult.value)
          this.logSftpOperation('upload_complete', 'success', completeResult.value.durationMs, {
            transferId: request.transferId,
            bytesTransferred: completeResult.value.bytesTransferred
          })
        }
      }
    } else {
      this.emitSftpError('upload', result.error)
    }
  }

  /**
   * Handle sftp-upload-cancel event
   *
   * SECURITY: Verifies that the requesting session owns the transfer
   * before cancelling to prevent unauthorized cancellation attacks.
   */
  handleUploadCancel(data: unknown): void {
    const validation = validateSftpUploadCancelRequest(data)
    if (!validation.ok) {
      this.emitValidationError('upload', validation.error.message)
      return
    }

    const request = validation.value
    const sftp = this.getSftpService()
    if (sftp === undefined) {
      return
    }

    // Get session IDs for ownership verification
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      return // No session, nothing to cancel
    }

    // SECURITY: Verify ownership before cancelling
    const ownershipResult = sftp.verifyTransferOwnership(request.transferId, ids.sessionId)
    if (!ownershipResult.ok) {
      // Log authorization rejection for security audit
      this.logAuthorizationRejection('upload_cancel', request.transferId, ids.sessionId)
      // Silent return - don't reveal transfer existence to potential attacker
      return
    }

    sftp.cancelUpload(request.transferId)
    this.logSftpOperation('upload_cancel', 'success', 0, { transferId: request.transferId })
  }

  /**
   * Handle sftp-download-start event
   *
   * Server generates the transferId and returns it in the response.
   * This ensures proper ownership tracking and prevents authorization bypass.
   */
  async handleDownloadStart(data: unknown): Promise<void> {
    const startTime = Date.now()

    if (!this.ensureSftpEnabled()) {
      return
    }

    const validation = validateSftpDownloadStartRequest(data)
    if (!validation.ok) {
      this.emitValidationError('download', validation.error.message)
      return
    }

    const request = validation.value
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      this.emitNoConnectionError('download')
      return
    }

    const sftp = this.getSftpService()
    if (sftp === undefined) {
      this.emitNotEnabledError('download')
      return
    }

    // SERVER generates the transferId (security: prevents authorization bypass)
    const transferId = generateTransferId()

    const result = await sftp.startDownload({
      transferId,
      sessionId: ids.sessionId,
      connectionId: ids.connectionId,
      remotePath: request.remotePath
    })

    if (result.ok) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_DOWNLOAD_READY, result.value)
      this.logSftpOperation('download_start', 'success', Date.now() - startTime, {
        transferId,
        fileName: result.value.fileName,
        fileSize: result.value.fileSize
      })

      // Stream download chunks to client
      const downloadCallbacks: DownloadStreamCallbacks = {
        onChunk: (chunk) => {
          this.context.socket.emit(SOCKET_EVENTS.SFTP_DOWNLOAD_CHUNK, chunk)
        },
        onProgress: (progress) => {
          this.context.socket.emit(SOCKET_EVENTS.SFTP_PROGRESS, progress)
        },
        onComplete: (complete) => {
          this.context.socket.emit(SOCKET_EVENTS.SFTP_COMPLETE, complete)
          this.logSftpOperation('download_complete', 'success', complete.durationMs, {
            transferId,
            bytesTransferred: complete.bytesTransferred
          })
        },
        onError: (error) => {
          this.emitSftpError('download', error)
          this.logSftpOperation('download_chunk', 'failure', 0, {
            transferId,
            error: error.code
          })
        }
      }

      // Start streaming in the background (don't await - fire and forget)
      // The streaming will emit events as chunks are read
      void sftp.streamDownloadChunks(
        ids.connectionId,
        transferId,
        request.remotePath,
        result.value.fileSize,
        downloadCallbacks
      )
    } else {
      this.emitSftpError('download', result.error)
      this.logSftpOperation('download_start', 'failure', Date.now() - startTime, {
        transferId,
        error: result.error.code
      })
    }
  }

  /**
   * Handle sftp-download-cancel event
   *
   * SECURITY: Verifies that the requesting session owns the transfer
   * before cancelling to prevent unauthorized cancellation attacks.
   */
  handleDownloadCancel(data: unknown): void {
    const validation = validateSftpDownloadCancelRequest(data)
    if (!validation.ok) {
      this.emitValidationError('download', validation.error.message)
      return
    }

    const request = validation.value
    const sftp = this.getSftpService()
    if (sftp === undefined) {
      return
    }

    // Get session IDs for ownership verification
    const ids = this.getConnectionAndSessionIds()
    if (ids === null) {
      return // No session, nothing to cancel
    }

    // SECURITY: Verify ownership before cancelling
    const ownershipResult = sftp.verifyTransferOwnership(request.transferId, ids.sessionId)
    if (!ownershipResult.ok) {
      // Log authorization rejection for security audit
      this.logAuthorizationRejection('download_cancel', request.transferId, ids.sessionId)
      // Silent return - don't reveal transfer existence to potential attacker
      return
    }

    sftp.cancelDownload(request.transferId)
    this.logSftpOperation('download_cancel', 'success', 0, { transferId: request.transferId })
  }

  /**
   * Cleanup on disconnect
   */
  handleDisconnect(): void {
    const ids = this.getConnectionAndSessionIds()
    const sftp = this.getSftpService()

    if (sftp !== undefined && ids !== null) {
      sftp.closeSession(ids.connectionId)
      sftp.cancelSessionTransfers(ids.sessionId)
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getSftpService(): FileService | undefined {
    return this.context.services.sftp
  }

  private ensureSftpEnabled(): boolean {
    const sftp = this.getSftpService()
    const isEnabled = sftp?.isEnabled() ?? false
    if (!isEnabled) {
      this.context.socket.emit(SOCKET_EVENTS.SFTP_ERROR, {
        operation: 'list' as const,
        code: 'SFTP_NOT_ENABLED' as const,
        message: 'SFTP is not enabled'
      })
      return false
    }
    return true
  }

  private getConnectionAndSessionIds(): {
    connectionId: ConnectionId
    sessionId: SessionId
  } | null {
    const { connectionId, sessionId } = this.context.state
    if (connectionId === null || sessionId === null) {
      return null
    }
    return {
      connectionId: createConnectionId(connectionId),
      sessionId: createSessionId(sessionId)
    }
  }

  private emitValidationError(operation: string, message: string): void {
    this.context.socket.emit(SOCKET_EVENTS.SFTP_ERROR, {
      operation: operation as SftpOperation,
      code: 'SFTP_INVALID_REQUEST' as const,
      message
    })
  }

  private emitNoConnectionError(operation: string, transferId?: TransferId): void {
    const response: {
      operation: SftpOperation
      code: 'SFTP_NO_CONNECTION'
      message: string
      transferId?: TransferId
    } = {
      operation: operation as SftpOperation,
      code: 'SFTP_NO_CONNECTION',
      message: 'No SSH connection established'
    }

    if (transferId !== undefined) {
      response.transferId = transferId
    }

    this.context.socket.emit(SOCKET_EVENTS.SFTP_ERROR, response)
  }

  private emitNotEnabledError(operation: string, transferId?: TransferId): void {
    const response: {
      operation: SftpOperation
      code: 'SFTP_NOT_ENABLED'
      message: string
      transferId?: TransferId
    } = {
      operation: operation as SftpOperation,
      code: 'SFTP_NOT_ENABLED',
      message: 'SFTP is not enabled'
    }

    if (transferId !== undefined) {
      response.transferId = transferId
    }

    this.context.socket.emit(SOCKET_EVENTS.SFTP_ERROR, response)
  }

  private emitSftpError(operation: string, error: SftpServiceError): void {
    const response: {
      operation: SftpOperation
      code: SftpServiceError['code']
      message: string
      path?: string
      transferId?: TransferId
    } = {
      operation: operation as SftpOperation,
      code: error.code,
      message: error.message
    }

    if (error.path !== undefined) {
      response.path = error.path
    }

    if (error.transferId !== undefined) {
      response.transferId = error.transferId
    }

    this.context.socket.emit(SOCKET_EVENTS.SFTP_ERROR, response)
  }

  private logSftpOperation(
    operation: SftpLogOperation,
    status: 'success' | 'failure',
    durationMs: number,
    data: Record<string, unknown>
  ): void {
    const level = status === 'success' ? 'info' : 'warn'
    const message = status === 'success' ? `SFTP ${operation} succeeded` : `SFTP ${operation} failed`

    const eventName = getSftpLogEventName(operation)

    emitSocketLog(this.context, level, eventName, message, {
      status,
      subsystem: 'sftp',
      durationMs,
      data
    })
  }

  /**
   * Log an authorization rejection for security audit.
   *
   * Called when a session attempts to access a transfer it does not own.
   * Uses 'policy_block' event type with SFTP-specific data.
   */
  private logAuthorizationRejection(
    operation: string,
    transferId: TransferId,
    requestingSessionId: SessionId
  ): void {
    const clientIp = this.context.state.clientIp ?? 'unknown'
    const timestamp = new Date().toISOString()

    emitSocketLog(this.context, 'warn', 'policy_block',
      `SFTP ${operation} authorization rejected`, {
        status: 'failure',
        subsystem: 'sftp',
        data: {
          operation,
          transferId,
          requestingSessionId,
          clientIp,
          timestamp,
          reason: 'ownership_verification_failed'
        }
      })
  }
}

/**
 * SFTP operation names for logging
 */
type SftpLogOperation =
  | 'list'
  | 'stat'
  | 'mkdir'
  | 'delete'
  | 'upload_start'
  | 'upload_chunk'
  | 'upload_complete'
  | 'upload_cancel'
  | 'download_start'
  | 'download_chunk'
  | 'download_complete'
  | 'download_cancel'

/**
 * Get log event name for an SFTP operation
 * Uses switch for type safety and to avoid object injection warnings
 */
function getSftpLogEventName(operation: SftpLogOperation): 'sftp_list' | 'sftp_stat' | 'sftp_mkdir' | 'sftp_delete' | 'sftp_upload_start' | 'sftp_upload_chunk' | 'sftp_upload_complete' | 'sftp_upload_cancel' | 'sftp_download_start' | 'sftp_download_chunk' | 'sftp_download_complete' | 'sftp_download_cancel' {
  switch (operation) {
    case 'list': return 'sftp_list'
    case 'stat': return 'sftp_stat'
    case 'mkdir': return 'sftp_mkdir'
    case 'delete': return 'sftp_delete'
    case 'upload_start': return 'sftp_upload_start'
    case 'upload_chunk': return 'sftp_upload_chunk'
    case 'upload_complete': return 'sftp_upload_complete'
    case 'upload_cancel': return 'sftp_upload_cancel'
    case 'download_start': return 'sftp_download_start'
    case 'download_chunk': return 'sftp_download_chunk'
    case 'download_complete': return 'sftp_download_complete'
    case 'download_cancel': return 'sftp_download_cancel'
  }
}
