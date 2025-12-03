/**
 * SFTP Service
 *
 * Main orchestration service for SFTP file transfer operations.
 * Coordinates between session management, path validation, rate limiting,
 * and transfer tracking.
 *
 * @module services/sftp/sftp-service
 */

import type { Client as SSH2Client, SFTPWrapper } from 'ssh2'
import type { Readable } from 'node:stream'
import type { ConnectionId, SessionId, TransferId } from '../../types/branded.js'
import type { Result } from '../../types/result.js'
import type { SftpConfig } from '../../types/config.js'
import type {
  SftpErrorCode,
  SftpDirectoryResponse,
  SftpStatResponse,
  SftpOperationResponse,
  SftpUploadReadyResponse,
  SftpUploadAckResponse,
  SftpDownloadReadyResponse,
  SftpProgressResponse,
  SftpCompleteResponse
} from '../../types/contracts/v1/sftp.js'
import { ok, err } from '../../utils/result.js'
import { SFTP_DEFAULTS, SFTP_ERROR_CODES, SFTP_ERROR_MESSAGES, getMimeType } from '../../constants/sftp.js'
import {
  createSftpSessionManager,
  type SftpSession,
  type SftpSessionError,
  type SftpSessionManager
} from './sftp-session.js'
import {
  validatePath,
  validateFileName,
  type PathValidationOptions
} from './path-validator.js'
import {
  createTransferManager,
  type TransferManager
} from './transfer-manager.js'
import debug from 'debug'

const logger = debug('webssh2:services:sftp')

/**
 * SFTP service error with typed code
 */
export interface SftpServiceError {
  readonly code: SftpErrorCode
  readonly message: string
  readonly path?: string | undefined
  readonly transferId?: TransferId | undefined
}

/**
 * Dependencies for the SFTP service
 */
export interface SftpServiceDependencies {
  /** Get SSH client for a connection */
  getSSHClient: (connectionId: ConnectionId) => SSH2Client | undefined
}

/**
 * Upload start request
 */
export interface UploadStartRequest {
  readonly transferId: TransferId
  readonly sessionId: SessionId
  readonly connectionId: ConnectionId
  readonly remotePath: string
  readonly fileName: string
  readonly fileSize: number
  readonly mimeType?: string
  readonly overwrite?: boolean
}

/**
 * Upload chunk request
 */
export interface UploadChunkRequest {
  readonly transferId: TransferId
  readonly chunkIndex: number
  readonly data: Buffer
  readonly isLast: boolean
}

/**
 * Download start request
 */
export interface DownloadStartRequest {
  readonly transferId: TransferId
  readonly sessionId: SessionId
  readonly connectionId: ConnectionId
  readonly remotePath: string
}

/**
 * Download chunk data emitted during streaming
 */
export interface DownloadChunkData {
  readonly transferId: TransferId
  readonly chunkIndex: number
  readonly data: string // Base64 encoded
  readonly isLast: boolean
}

/**
 * Callbacks for download streaming
 */
export interface DownloadStreamCallbacks {
  /** Called for each chunk */
  onChunk: (chunk: DownloadChunkData) => void
  /** Called periodically with progress */
  onProgress: (progress: SftpProgressResponse) => void
  /** Called when download completes */
  onComplete: (result: SftpCompleteResponse) => void
  /** Called on error */
  onError: (error: SftpServiceError) => void
}

/**
 * SFTP Service Implementation
 *
 * Provides high-level SFTP operations with:
 * - Path validation and security
 * - Rate limiting
 * - Progress tracking
 * - Error handling with typed errors
 */
export class SftpService {
  private readonly sessionManager: SftpSessionManager
  private readonly transferManager: TransferManager
  private readonly config: SftpConfig
  private readonly deps: SftpServiceDependencies

  // Active file handles for uploads
  private readonly uploadHandles = new Map<TransferId, { handle: Buffer; sftp: SFTPWrapper }>()

  // Active download state (stream may be null for parallel read implementation)
  private readonly downloadStreams = new Map<TransferId, {
    stream: Readable | null
    cancelled: boolean
  }>()

  constructor(config: SftpConfig, deps: SftpServiceDependencies) {
    this.config = config
    this.deps = deps
    this.sessionManager = createSftpSessionManager({ timeout: config.timeout })
    this.transferManager = createTransferManager({
      maxConcurrentTransfers: config.maxConcurrentTransfers,
      defaultRateLimitBytesPerSec: config.transferRateLimitBytesPerSec
    })
  }

  /**
   * Check if SFTP is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Get path validation options from config
   */
  private getPathValidationOptions(checkExtension: boolean): PathValidationOptions {
    return {
      allowedPaths: this.config.allowedPaths,
      blockedExtensions: this.config.blockedExtensions,
      checkExtension
    }
  }

  /**
   * Resolve path if it contains ~ (SFTP subsystem doesn't expand shell shortcuts)
   */
  private async resolveTildePath(
    session: SftpSession,
    path: string
  ): Promise<Result<string, SftpServiceError>> {
    if (path === '~' || path.startsWith('~/')) {
      const expandResult = await this.sessionManager.expandTildePath(session, path)
      if (!expandResult.ok) {
        return err(mapSessionError(expandResult.error))
      }
      logger('Resolved path %s to %s', path, expandResult.value)
      return ok(expandResult.value)
    }
    return ok(path)
  }

  /**
   * Ensure SFTP session exists for a connection
   */
  private async ensureSession(
    connectionId: ConnectionId,
    sessionId: SessionId
  ): Promise<Result<SftpSession, SftpServiceError>> {
    // Check for existing session
    const existing = this.sessionManager.getSession(connectionId)
    if (existing !== undefined) {
      return ok(existing)
    }

    // Get SSH client
    const client = this.deps.getSSHClient(connectionId)
    if (client === undefined) {
      return err({
        code: 'SFTP_NO_CONNECTION',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NO_CONNECTION]
      })
    }

    // Open new session
    const result = await this.sessionManager.openSession(connectionId, sessionId, client)
    if (!result.ok) {
      return err(mapSessionError(result.error))
    }

    return ok(result.value)
  }

  /**
   * List directory contents
   */
  async listDirectory(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string,
    showHidden: boolean = false
  ): Promise<Result<SftpDirectoryResponse, SftpServiceError>> {
    if (!this.config.enabled) {
      return err({
        code: 'SFTP_NOT_ENABLED',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED]
      })
    }

    // Validate path
    const pathResult = validatePath(path, this.getPathValidationOptions(false))
    if (!pathResult.ok) {
      return err({
        code: pathResult.error.code === 'PATH_FORBIDDEN' ? 'SFTP_PATH_FORBIDDEN' : 'SFTP_INVALID_REQUEST',
        message: pathResult.error.message,
        path
      })
    }

    // Get session
    const sessionResult = await this.ensureSession(connectionId, sessionId)
    if (!sessionResult.ok) {
      return err(sessionResult.error)
    }

    // Resolve ~ paths
    const resolveResult = await this.resolveTildePath(sessionResult.value, pathResult.value)
    if (!resolveResult.ok) {
      return err(resolveResult.error)
    }
    const resolvedPath = resolveResult.value

    // List directory
    const listResult = await this.sessionManager.listDirectory(
      sessionResult.value,
      resolvedPath,
      { showHidden }
    )

    if (!listResult.ok) {
      return err(mapSessionError(listResult.error))
    }

    return ok({
      path: resolvedPath,
      entries: listResult.value
    })
  }

  /**
   * Get file/directory information
   */
  async stat(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string
  ): Promise<Result<SftpStatResponse, SftpServiceError>> {
    if (!this.config.enabled) {
      return err({
        code: 'SFTP_NOT_ENABLED',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED]
      })
    }

    // Validate path
    const pathResult = validatePath(path, this.getPathValidationOptions(false))
    if (!pathResult.ok) {
      return err({
        code: pathResult.error.code === 'PATH_FORBIDDEN' ? 'SFTP_PATH_FORBIDDEN' : 'SFTP_INVALID_REQUEST',
        message: pathResult.error.message,
        path
      })
    }

    // Get session
    const sessionResult = await this.ensureSession(connectionId, sessionId)
    if (!sessionResult.ok) {
      return err(sessionResult.error)
    }

    // Resolve ~ paths
    const resolveResult = await this.resolveTildePath(sessionResult.value, pathResult.value)
    if (!resolveResult.ok) {
      return err(resolveResult.error)
    }
    const resolvedPath = resolveResult.value

    // Stat file
    const statResult = await this.sessionManager.stat(sessionResult.value, resolvedPath)

    if (!statResult.ok) {
      return err(mapSessionError(statResult.error))
    }

    return ok({
      path: resolvedPath,
      entry: statResult.value
    })
  }

  /**
   * Create a directory
   */
  async mkdir(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string,
    mode?: number
  ): Promise<Result<SftpOperationResponse, SftpServiceError>> {
    if (!this.config.enabled) {
      return err({
        code: 'SFTP_NOT_ENABLED',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED]
      })
    }

    // Validate path
    const pathResult = validatePath(path, this.getPathValidationOptions(false))
    if (!pathResult.ok) {
      return err({
        code: pathResult.error.code === 'PATH_FORBIDDEN' ? 'SFTP_PATH_FORBIDDEN' : 'SFTP_INVALID_REQUEST',
        message: pathResult.error.message,
        path
      })
    }

    // Get session
    const sessionResult = await this.ensureSession(connectionId, sessionId)
    if (!sessionResult.ok) {
      return err(sessionResult.error)
    }

    // Resolve ~ paths
    const resolveResult = await this.resolveTildePath(sessionResult.value, pathResult.value)
    if (!resolveResult.ok) {
      return err(resolveResult.error)
    }
    const resolvedPath = resolveResult.value

    // Create directory
    const mkdirResult = await this.sessionManager.mkdir(
      sessionResult.value,
      resolvedPath,
      mode ?? SFTP_DEFAULTS.DEFAULT_DIR_MODE
    )

    if (!mkdirResult.ok) {
      return err(mapSessionError(mkdirResult.error))
    }

    logger('Directory created:', resolvedPath)
    return ok({
      success: true,
      path: resolvedPath
    })
  }

  /**
   * Delete a file or directory
   */
  async delete(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string,
    // Reserved for future recursive directory deletion implementation
    _recursive: boolean = false
  ): Promise<Result<SftpOperationResponse, SftpServiceError>> {
    // Validate inputs first (no async operations)
    const validationResult = this.validateDeleteRequest(path)
    if (!validationResult.ok) {
      return validationResult
    }

    // Execute the delete operation
    return this.executeDelete(
      connectionId,
      sessionId,
      validationResult.value
    )
  }

  /**
   * Validate delete request parameters
   */
  private validateDeleteRequest(
    path: string
  ): Result<string, SftpServiceError> {
    if (!this.config.enabled) {
      return err({
        code: 'SFTP_NOT_ENABLED',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED]
      })
    }

    const pathResult = validatePath(path, this.getPathValidationOptions(false))
    if (!pathResult.ok) {
      return err({
        code: pathResult.error.code === 'PATH_FORBIDDEN' ? 'SFTP_PATH_FORBIDDEN' : 'SFTP_INVALID_REQUEST',
        message: pathResult.error.message,
        path
      })
    }

    return ok(pathResult.value)
  }

  /**
   * Execute delete operation after validation
   */
  private async executeDelete(
    connectionId: ConnectionId,
    sessionId: SessionId,
    validatedPath: string
  ): Promise<Result<SftpOperationResponse, SftpServiceError>> {
    // Get session
    const sessionResult = await this.ensureSession(connectionId, sessionId)
    if (!sessionResult.ok) {
      return err(sessionResult.error)
    }

    // Resolve ~ paths
    const resolveResult = await this.resolveTildePath(sessionResult.value, validatedPath)
    if (!resolveResult.ok) {
      return err(resolveResult.error)
    }
    const resolvedPath = resolveResult.value

    // Stat to determine if file or directory
    const statResult = await this.sessionManager.stat(sessionResult.value, resolvedPath)
    if (!statResult.ok) {
      return err(mapSessionError(statResult.error))
    }

    // Delete based on type (recursive not yet implemented - only removes empty directories)
    const deleteResult = statResult.value.type === 'directory'
      ? await this.sessionManager.rmdir(sessionResult.value, resolvedPath)
      : await this.sessionManager.unlink(sessionResult.value, resolvedPath)

    if (!deleteResult.ok) {
      return err(mapSessionError(deleteResult.error))
    }

    logger('Deleted:', resolvedPath)
    return ok({
      success: true,
      path: resolvedPath
    })
  }

  /**
   * Start an upload
   */
  async startUpload(
    request: UploadStartRequest
  ): Promise<Result<SftpUploadReadyResponse, SftpServiceError>> {
    if (!this.config.enabled) {
      return err({
        code: 'SFTP_NOT_ENABLED',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED]
      })
    }

    // Check file size
    if (request.fileSize > this.config.maxFileSize) {
      return err({
        code: 'SFTP_FILE_TOO_LARGE',
        message: `File size ${request.fileSize} exceeds maximum ${this.config.maxFileSize}`,
        transferId: request.transferId
      })
    }

    // Validate filename
    const fileNameResult = validateFileName(request.fileName)
    if (!fileNameResult.ok) {
      return err({
        code: 'SFTP_INVALID_REQUEST',
        message: fileNameResult.error.message,
        transferId: request.transferId
      })
    }

    // Validate path
    const pathResult = validatePath(request.remotePath, this.getPathValidationOptions(true))
    if (!pathResult.ok) {
      const code = mapPathErrorCode(pathResult.error.code)
      return err({
        code,
        message: pathResult.error.message,
        path: request.remotePath,
        transferId: request.transferId
      })
    }

    // Get session
    const sessionResult = await this.ensureSession(request.connectionId, request.sessionId)
    if (!sessionResult.ok) {
      return err({ ...sessionResult.error, transferId: request.transferId })
    }

    // Resolve ~ paths
    const resolveResult = await this.resolveTildePath(sessionResult.value, pathResult.value)
    if (!resolveResult.ok) {
      return err({ ...resolveResult.error, transferId: request.transferId })
    }
    const resolvedPath = resolveResult.value

    // Check if file exists (if not overwriting)
    if (request.overwrite !== true) {
      const statResult = await this.sessionManager.stat(sessionResult.value, resolvedPath)
      if (statResult.ok) {
        return err({
          code: 'SFTP_ALREADY_EXISTS',
          message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.ALREADY_EXISTS],
          path: resolvedPath,
          transferId: request.transferId
        })
      }
    }

    // Start tracking transfer
    const transferResult = this.transferManager.startTransfer({
      transferId: request.transferId,
      sessionId: request.sessionId,
      direction: 'upload',
      remotePath: resolvedPath,
      fileName: request.fileName,
      totalBytes: request.fileSize,
      rateLimitBytesPerSec: this.config.transferRateLimitBytesPerSec
    })

    if (!transferResult.ok) {
      return err({
        code: transferResult.error.code === 'MAX_TRANSFERS' ? 'SFTP_MAX_TRANSFERS' : 'SFTP_INVALID_REQUEST',
        message: transferResult.error.message,
        transferId: request.transferId
      })
    }

    // Open file for writing
    const sftp = sessionResult.value.sftp
    const flags = request.overwrite === true ? 'w' : 'wx'

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.transferManager.cancelTransfer(request.transferId)
        resolve(err({
          code: 'SFTP_TIMEOUT',
          message: 'Upload start timeout',
          transferId: request.transferId
        }))
      }, this.config.timeout)

      sftp.open(resolvedPath, flags, (openErr: Error | null | undefined, handle: Buffer) => {
        clearTimeout(timeout)

        if (openErr !== null && openErr !== undefined) {
          this.transferManager.cancelTransfer(request.transferId)
          resolve(err({
            code: 'SFTP_PERMISSION_DENIED',
            message: openErr.message,
            path: resolvedPath,
            transferId: request.transferId
          }))
          return
        }

        // Store handle for later chunks
        this.uploadHandles.set(request.transferId, { handle, sftp })

        // Activate transfer
        this.transferManager.activateTransfer(request.transferId)

        logger('Upload started:', request.transferId, resolvedPath)
        resolve(ok({
          transferId: request.transferId,
          chunkSize: this.config.chunkSize,
          maxConcurrentChunks: 1 // Sequential for now
        }))
      })
    })
  }

  /**
   * Process an upload chunk
   */
  async processUploadChunk(
    request: UploadChunkRequest
  ): Promise<Result<SftpUploadAckResponse, SftpServiceError>> {
    const handleInfo = this.uploadHandles.get(request.transferId)
    if (handleInfo === undefined) {
      return err({
        code: 'SFTP_INVALID_REQUEST',
        message: 'Transfer not found or already completed',
        transferId: request.transferId
      })
    }

    // Update transfer progress
    const updateResult = this.transferManager.updateProgress(
      request.transferId,
      request.chunkIndex,
      request.data.length
    )

    if (!updateResult.ok) {
      return err({
        code: updateResult.error.code === 'CHUNK_MISMATCH' ? 'SFTP_CHUNK_ERROR' : 'SFTP_INVALID_REQUEST',
        message: updateResult.error.message,
        transferId: request.transferId
      })
    }

    const transfer = updateResult.value
    const offset = transfer.bytesTransferred - request.data.length

    // Write chunk to file
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(err({
          code: 'SFTP_TIMEOUT',
          message: 'Chunk write timeout',
          transferId: request.transferId
        }))
      }, this.config.timeout)

      handleInfo.sftp.write(
        handleInfo.handle,
        request.data,
        0,
        request.data.length,
        offset,
        (writeErr: Error | null | undefined) => {
          clearTimeout(timeout)

          if (writeErr !== null && writeErr !== undefined) {
            this.cleanupUpload(request.transferId)
            resolve(err({
              code: 'SFTP_CHUNK_ERROR',
              message: writeErr.message,
              transferId: request.transferId
            }))
            return
          }

          // If last chunk, close the file
          if (request.isLast) {
            this.closeUpload(request.transferId)
          }

          resolve(ok({
            transferId: request.transferId,
            chunkIndex: request.chunkIndex,
            bytesReceived: transfer.bytesTransferred
          }))
        }
      )
    })
  }

  /**
   * Complete an upload
   */
  completeUpload(transferId: TransferId): Result<SftpCompleteResponse, SftpServiceError> {
    const result = this.transferManager.completeTransfer(transferId)
    if (!result.ok) {
      return err({
        code: 'SFTP_INVALID_REQUEST',
        message: result.error.message,
        transferId
      })
    }

    this.closeUpload(transferId)
    logger('Upload completed:', transferId)

    return ok({
      transferId,
      direction: 'upload',
      bytesTransferred: result.value.bytesTransferred,
      durationMs: result.value.durationMs,
      averageBytesPerSecond: result.value.averageBytesPerSecond
    })
  }

  /**
   * Cancel an upload
   */
  cancelUpload(transferId: TransferId): Result<void, SftpServiceError> {
    this.cleanupUpload(transferId)
    this.transferManager.cancelTransfer(transferId)
    logger('Upload cancelled:', transferId)
    return ok(undefined)
  }

  /**
   * Get transfer progress
   */
  getProgress(transferId: TransferId): Result<SftpProgressResponse, SftpServiceError> {
    const result = this.transferManager.getProgress(transferId)
    if (!result.ok) {
      return err({
        code: 'SFTP_INVALID_REQUEST',
        message: result.error.message,
        transferId
      })
    }

    return ok({
      transferId,
      direction: result.value.direction,
      bytesTransferred: result.value.bytesTransferred,
      totalBytes: result.value.totalBytes,
      percentComplete: result.value.percentComplete,
      bytesPerSecond: result.value.bytesPerSecond,
      estimatedSecondsRemaining: result.value.estimatedSecondsRemaining
    })
  }

  /**
   * Start a download
   */
  async startDownload(
    request: DownloadStartRequest
  ): Promise<Result<SftpDownloadReadyResponse, SftpServiceError>> {
    if (!this.config.enabled) {
      return err({
        code: 'SFTP_NOT_ENABLED',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED]
      })
    }

    // Validate path (checkExtension=true to enforce blocked extensions on downloads)
    const pathResult = validatePath(request.remotePath, this.getPathValidationOptions(true))
    if (!pathResult.ok) {
      const code = mapPathErrorCode(pathResult.error.code)
      return err({
        code,
        message: pathResult.error.message,
        path: request.remotePath,
        transferId: request.transferId
      })
    }

    // Get session
    const sessionResult = await this.ensureSession(request.connectionId, request.sessionId)
    if (!sessionResult.ok) {
      return err({ ...sessionResult.error, transferId: request.transferId })
    }

    // Resolve ~ paths
    const resolveResult = await this.resolveTildePath(sessionResult.value, pathResult.value)
    if (!resolveResult.ok) {
      return err({ ...resolveResult.error, transferId: request.transferId })
    }
    const resolvedPath = resolveResult.value

    // Get file info
    const statResult = await this.sessionManager.stat(sessionResult.value, resolvedPath)
    if (!statResult.ok) {
      return err({
        ...mapSessionError(statResult.error),
        transferId: request.transferId
      })
    }

    const fileInfo = statResult.value
    if (fileInfo.type !== 'file') {
      return err({
        code: 'SFTP_INVALID_REQUEST',
        message: 'Can only download files',
        path: resolvedPath,
        transferId: request.transferId
      })
    }

    // Check file size
    if (fileInfo.size > this.config.maxFileSize) {
      return err({
        code: 'SFTP_FILE_TOO_LARGE',
        message: `File size ${fileInfo.size} exceeds maximum ${this.config.maxFileSize}`,
        path: resolvedPath,
        transferId: request.transferId
      })
    }

    // Start tracking transfer
    const transferResult = this.transferManager.startTransfer({
      transferId: request.transferId,
      sessionId: request.sessionId,
      direction: 'download',
      remotePath: resolvedPath,
      fileName: fileInfo.name,
      totalBytes: fileInfo.size,
      rateLimitBytesPerSec: this.config.transferRateLimitBytesPerSec
    })

    if (!transferResult.ok) {
      return err({
        code: transferResult.error.code === 'MAX_TRANSFERS' ? 'SFTP_MAX_TRANSFERS' : 'SFTP_INVALID_REQUEST',
        message: transferResult.error.message,
        transferId: request.transferId
      })
    }

    this.transferManager.activateTransfer(request.transferId)
    logger('Download started:', request.transferId, pathResult.value)

    return ok({
      transferId: request.transferId,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      mimeType: getMimeType(fileInfo.name)
    })
  }

  /**
   * Stream download chunks to client
   *
   * Uses createReadStream for efficient pipelined reads with internal buffering.
   * Must be called after startDownload() succeeds.
   */
  async streamDownloadChunks(
    connectionId: ConnectionId,
    transferId: TransferId,
    remotePath: string,
    fileSize: number,
    callbacks: DownloadStreamCallbacks
  ): Promise<void> {
    // Get session
    const session = this.sessionManager.getSession(connectionId)
    if (session === undefined) {
      callbacks.onError({
        code: 'SFTP_NO_CONNECTION',
        message: 'SFTP session not found',
        transferId
      })
      return
    }

    const sftp = session.sftp
    const chunkSize = this.config.chunkSize

    // Use parallel reads for better throughput (similar to SSH2's fastGet)
    // This hides network latency by having multiple read requests in-flight
    const concurrency = SFTP_DEFAULTS.DOWNLOAD_CONCURRENCY
    const totalChunks = Math.ceil(fileSize / chunkSize)

    return new Promise((resolve) => {
      let nextChunkToRead = 0
      let nextChunkToEmit = 0
      let bytesTransferred = 0
      let lastProgressTime = Date.now()
      const progressInterval = SFTP_DEFAULTS.PROGRESS_INTERVAL_MS
      let hasError = false
      let fileHandle: Buffer | null = null
      const startTime = Date.now()

      // Buffer to hold out-of-order chunks until they can be emitted in order
      const chunkBuffer = new Map<number, Buffer>()

      // Track cancellation
      const downloadState = { cancelled: false }
      this.downloadStreams.set(transferId, { stream: null, cancelled: false })

      const emitBufferedChunks = (): void => {
        // Emit chunks in order as they become available
        let chunk = chunkBuffer.get(nextChunkToEmit)
        while (chunk !== undefined) {
          chunkBuffer.delete(nextChunkToEmit)

          bytesTransferred += chunk.length
          const isLast = nextChunkToEmit === totalChunks - 1

          // Update progress in transfer manager
          this.transferManager.updateProgress(transferId, nextChunkToEmit, chunk.length)

          // Encode chunk as base64 and emit
          const base64Data = chunk.toString('base64')
          callbacks.onChunk({
            transferId,
            chunkIndex: nextChunkToEmit,
            data: base64Data,
            isLast
          })

          // Emit progress periodically
          const now = Date.now()
          if (now - lastProgressTime >= progressInterval) {
            lastProgressTime = now
            const progressResult = this.getProgress(transferId)
            if (progressResult.ok) {
              callbacks.onProgress(progressResult.value)
            }
          }

          // Log timing every 100 chunks
          if (nextChunkToEmit > 0 && nextChunkToEmit % 100 === 0) {
            const currentRate = bytesTransferred / ((now - startTime) / 1000)
            logger('Download chunk #%d: rate=%s KB/s', nextChunkToEmit, (currentRate / 1024).toFixed(2))
          }

          nextChunkToEmit++

          if (isLast) {
            // All chunks emitted - complete the transfer
            cleanup()
            const completeResult = this.transferManager.completeTransfer(transferId)
            if (completeResult.ok) {
              callbacks.onComplete({
                transferId,
                direction: 'download',
                bytesTransferred: completeResult.value.bytesTransferred,
                durationMs: completeResult.value.durationMs,
                averageBytesPerSecond: completeResult.value.averageBytesPerSecond
              })
            }
            logger('Download completed:', transferId)
            resolve()
            return
          }

          // Get next chunk for the while loop
          chunk = chunkBuffer.get(nextChunkToEmit)
        }
      }

      const cleanup = (): void => {
        this.downloadStreams.delete(transferId)
        if (fileHandle !== null) {
          sftp.close(fileHandle, () => { /* ignore */ })
          fileHandle = null
        }
      }

      const readChunk = (chunkIdx: number): void => {
        if (hasError || downloadState.cancelled || fileHandle === null) {
          return
        }

        const offset = chunkIdx * chunkSize
        const bytesToRead = Math.min(chunkSize, fileSize - offset)
        const buffer = Buffer.alloc(bytesToRead)

        sftp.read(fileHandle, buffer, 0, bytesToRead, offset,
          (err: Error | null | undefined, bytesRead: number, data: Buffer) => {
            if (hasError || downloadState.cancelled) {
              return
            }

            if (err !== null && err !== undefined) {
              hasError = true
              cleanup()
              this.transferManager.cancelTransfer(transferId)
              callbacks.onError({
                code: 'SFTP_CHUNK_ERROR',
                message: err.message,
                path: remotePath,
                transferId
              })
              resolve()
              return
            }

            // Store chunk in buffer (may arrive out of order)
            chunkBuffer.set(chunkIdx, data.subarray(0, bytesRead))

            // Try to emit buffered chunks in order
            emitBufferedChunks()

            // Start next chunk read if more to read
            if (nextChunkToRead < totalChunks) {
              const nextIdx = nextChunkToRead++
              readChunk(nextIdx)
            }
          })
      }

      // Open file first
      sftp.open(remotePath, 'r', (openErr: Error | null | undefined, handle: Buffer) => {
        if (openErr !== null && openErr !== undefined) {
          this.transferManager.cancelTransfer(transferId)
          callbacks.onError({
            code: 'SFTP_PERMISSION_DENIED',
            message: openErr.message,
            path: remotePath,
            transferId
          })
          resolve()
          return
        }

        fileHandle = handle

        // Check cancellation
        const streamInfo = this.downloadStreams.get(transferId)
        if (streamInfo !== undefined) {
          downloadState.cancelled = streamInfo.cancelled
        }

        if (downloadState.cancelled) {
          cleanup()
          resolve()
          return
        }

        // Start initial parallel reads
        const initialReads = Math.min(concurrency, totalChunks)
        for (let i = 0; i < initialReads; i++) {
          const chunkIdx = nextChunkToRead++
          readChunk(chunkIdx)
        }
      })
    })
  }

  /**
   * Cancel a download
   */
  cancelDownload(transferId: TransferId): Result<void, SftpServiceError> {
    // Mark as cancelled - the download loop will check this flag
    const streamInfo = this.downloadStreams.get(transferId)
    if (streamInfo !== undefined) {
      streamInfo.cancelled = true
      // If there's a stream (legacy), destroy it
      if (streamInfo.stream !== null) {
        streamInfo.stream.destroy()
      }
      this.downloadStreams.delete(transferId)
    }
    this.transferManager.cancelTransfer(transferId)
    logger('Download cancelled:', transferId)
    return ok(undefined)
  }

  /**
   * Close session for a connection
   */
  closeSession(connectionId: ConnectionId): void {
    this.sessionManager.closeSession(connectionId)
  }

  /**
   * Cancel all transfers for a session
   */
  cancelSessionTransfers(sessionId: SessionId): void {
    this.transferManager.cancelSessionTransfers(sessionId)
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Close all upload handles
    for (const [transferId] of this.uploadHandles) {
      this.cleanupUpload(transferId)
    }
    // Cancel all downloads
    for (const [transferId, streamInfo] of this.downloadStreams) {
      streamInfo.cancelled = true
      if (streamInfo.stream !== null) {
        streamInfo.stream.destroy()
      }
      this.downloadStreams.delete(transferId)
    }
    this.transferManager.clear()
    this.sessionManager.closeAll()
  }

  /**
   * Helper: Close upload file handle
   *
   * Note: cleanupUpload is an alias that can be extended in the future
   * to delete partial files on failure. For now, both methods do the same thing.
   */
  private closeUpload(transferId: TransferId): void {
    const handleInfo = this.uploadHandles.get(transferId)
    if (handleInfo !== undefined) {
      try {
        handleInfo.sftp.close(handleInfo.handle, () => {
          // Ignore close errors
        })
      } catch {
        // Ignore close errors
      }
      this.uploadHandles.delete(transferId)
    }
  }

  /**
   * Helper: Cleanup failed upload (delete partial file)
   *
   * Currently delegates to closeUpload. In the future, this could be extended
   * to also delete the partial file from the remote server.
   */
  private cleanupUpload(transferId: TransferId): void {
    this.closeUpload(transferId)
  }

}

/**
 * Map path validation error code to service error code
 */
function mapPathErrorCode(code: string): SftpErrorCode {
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
 * Map session error to service error
 */
function mapSessionError(error: SftpSessionError): SftpServiceError {
  switch (error.code) {
    case 'NOT_FOUND':
      return {
        code: 'SFTP_NOT_FOUND',
        message: error.message,
        path: error.path
      }
    case 'PERMISSION_DENIED':
      return {
        code: 'SFTP_PERMISSION_DENIED',
        message: error.message,
        path: error.path
      }
    case 'TIMEOUT':
      return {
        code: 'SFTP_TIMEOUT',
        message: error.message,
        path: error.path
      }
    case 'SESSION_ERROR':
      return {
        code: 'SFTP_SESSION_ERROR',
        message: error.message
      }
    case 'OPERATION_FAILED':
      return {
        code: 'SFTP_SESSION_ERROR',
        message: error.message,
        path: error.path
      }
  }
}

/**
 * Create SFTP service
 */
export function createSftpService(
  config: SftpConfig,
  deps: SftpServiceDependencies
): SftpService {
  return new SftpService(config, deps)
}
