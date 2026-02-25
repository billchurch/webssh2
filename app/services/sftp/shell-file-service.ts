/**
 * Shell File Service
 *
 * Implements the FileService interface using shell commands (ls, cat, echo)
 * via SSH exec, for BusyBox/dropbear devices that don't support the SFTP
 * subsystem.
 *
 * @module services/sftp/shell-file-service
 */

import type { Client as SSH2Client, ClientChannel } from 'ssh2'
import type { ConnectionId, SessionId, TransferId } from '../../types/branded.js'
import type { Result } from '../../types/result.js'
import type { SftpConfig } from '../../types/config.js'
import type {
  SftpDirectoryResponse,
  SftpStatResponse,
  SftpOperationResponse,
  SftpUploadReadyResponse,
  SftpUploadAckResponse,
  SftpDownloadReadyResponse,
  SftpCompleteResponse
} from '../../types/contracts/v1/sftp.js'
import type { FileService } from './file-service.js'
import type {
  SftpServiceError,
  SftpServiceDependencies,
  UploadStartRequest,
  UploadChunkRequest,
  DownloadStartRequest,
  DownloadStreamCallbacks
} from './sftp-service.js'
import {
  createTransferManager,
  type TransferManager,
  type ManagedTransfer,
  type TransferError
} from './transfer-manager.js'
import { ok, err } from '../../utils/result.js'
import { SFTP_DEFAULTS, SFTP_ERROR_CODES, SFTP_ERROR_MESSAGES, getMimeType } from '../../constants/sftp.js'
import {
  validatePath,
  validateFileName,
} from './path-validator.js'
import {
  mapPathErrorCode,
  getPathValidationOptions,
  mapTransferStartError
} from './file-service-shared.js'
import {
  escapeShellPath,
  buildListCommand,
  buildStatCommand,
  buildHomeCommand,
  resolveHomePath,
  parseDirectoryListing,
  parseStatEntry
} from './shell-commands.js'
import debug from 'debug'

const logger = debug('webssh2:services:sftp:shell')

/**
 * Per-connection state for the shell backend
 */
interface ShellSession {
  readonly connectionId: ConnectionId
  readonly sessionId: SessionId
  /** Cached home directory path (resolved via `echo ~`) */
  homeDir: string | null
  lastActivity: number
}

/**
 * Active upload stream state
 */
interface UploadStream {
  readonly stream: ClientChannel
  readonly transferId: TransferId
  bytesWritten: number
}

/**
 * Active download state
 */
interface DownloadState {
  cancelled: boolean
}

/**
 * Shell File Service Implementation
 *
 * Uses shell commands (ls, cat) via client.exec() to provide file
 * operations on devices without SFTP subsystem support.
 */
export class ShellFileService implements FileService {
  private readonly sessions = new Map<ConnectionId, ShellSession>()
  private readonly transferManager: TransferManager
  private readonly config: SftpConfig
  private readonly deps: SftpServiceDependencies
  private readonly uploadStreams = new Map<TransferId, UploadStream>()
  private readonly downloadStates = new Map<TransferId, DownloadState>()

  constructor(config: SftpConfig, deps: SftpServiceDependencies) {
    this.config = config
    this.deps = deps
    this.transferManager = createTransferManager({
      maxConcurrentTransfers: config.maxConcurrentTransfers,
      defaultRateLimitBytesPerSec: config.transferRateLimitBytesPerSec
    })
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  async listDirectory(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string,
    showHidden: boolean = false
  ): Promise<Result<SftpDirectoryResponse, SftpServiceError>> {
    const setup = await this.setupOperation({ connectionId, sessionId, path, checkExtension: false })
    if (!setup.ok) {
      return setup
    }

    const { client, resolvedPath } = setup.value
    const command = buildListCommand(resolvedPath, showHidden)
    const execResult = await this.executeCommand(client, command)

    if (!execResult.ok) {
      return err(execResult.error)
    }

    const entries = parseDirectoryListing(execResult.value.stdout, resolvedPath)
    return ok({ path: resolvedPath, entries })
  }

  async stat(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string
  ): Promise<Result<SftpStatResponse, SftpServiceError>> {
    const setup = await this.setupOperation({ connectionId, sessionId, path, checkExtension: false })
    if (!setup.ok) {
      return setup
    }

    const { client, resolvedPath } = setup.value
    const command = buildStatCommand(resolvedPath)
    const execResult = await this.executeCommand(client, command)

    if (!execResult.ok) {
      return err(execResult.error)
    }

    const entry = parseStatEntry(execResult.value.stdout, resolvedPath)
    if (entry === null) {
      return err({
        code: 'SFTP_NOT_FOUND',
        message: 'Could not parse file information',
        path: resolvedPath
      })
    }

    return ok({ path: resolvedPath, entry })
  }

  mkdir(
    _connectionId: ConnectionId,
    _sessionId: SessionId,
    _path: string,
    _mode?: number
  ): Promise<Result<SftpOperationResponse, SftpServiceError>> {
    return Promise.resolve(err({
      code: 'SFTP_INVALID_REQUEST',
      message: 'mkdir is not supported with the shell backend'
    }))
  }

  delete(
    _connectionId: ConnectionId,
    _sessionId: SessionId,
    _path: string,
    _recursive?: boolean
  ): Promise<Result<SftpOperationResponse, SftpServiceError>> {
    return Promise.resolve(err({
      code: 'SFTP_INVALID_REQUEST',
      message: 'delete is not supported with the shell backend'
    }))
  }

  async startUpload(
    request: UploadStartRequest
  ): Promise<Result<SftpUploadReadyResponse, SftpServiceError>> {
    // Validate file size
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

    const setup = await this.setupOperation({
      connectionId: request.connectionId,
      sessionId: request.sessionId,
      path: request.remotePath,
      checkExtension: true,
      transferId: request.transferId
    })
    if (!setup.ok) {
      return setup
    }

    const { client, resolvedPath } = setup.value

    // Check if file exists (if not overwriting)
    if (request.overwrite !== true) {
      const statCommand = buildStatCommand(resolvedPath)
      const statResult = await this.executeCommand(client, statCommand)
      if (statResult.ok) {
        return err({
          code: 'SFTP_ALREADY_EXISTS',
          message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.ALREADY_EXISTS],
          path: resolvedPath,
          transferId: request.transferId
        })
      }
      // File not found is the expected case when not overwriting
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
      return err(mapTransferStartError(transferResult.error, request.transferId))
    }

    // Open a cat > file stream via exec
    const escapedPath = escapeShellPath(resolvedPath)
    const catCommand = `cat > ${escapedPath}`

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.transferManager.cancelTransfer(request.transferId)
        resolve(err({
          code: 'SFTP_TIMEOUT',
          message: 'Upload start timeout',
          transferId: request.transferId
        }))
      }, this.config.timeout)

      client.exec(catCommand, (execErr: Error | undefined, stream: ClientChannel) => {
        clearTimeout(timeout)

        if (execErr !== undefined) {
          this.transferManager.cancelTransfer(request.transferId)
          resolve(err({
            code: 'SFTP_PERMISSION_DENIED',
            message: execErr.message,
            path: resolvedPath,
            transferId: request.transferId
          }))
          return
        }

        // Store stream for later chunk writes
        this.uploadStreams.set(request.transferId, {
          stream,
          transferId: request.transferId,
          bytesWritten: 0
        })

        this.transferManager.activateTransfer(request.transferId)

        logger('Upload started (shell):', request.transferId, resolvedPath)
        resolve(ok({
          transferId: request.transferId,
          chunkSize: this.config.chunkSize,
          maxConcurrentChunks: 1
        }))
      })
    })
  }

  async processUploadChunk(
    request: UploadChunkRequest
  ): Promise<Result<SftpUploadAckResponse, SftpServiceError>> {
    const uploadInfo = this.uploadStreams.get(request.transferId)
    if (uploadInfo === undefined) {
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

    // Write chunk to stdin of cat process
    return new Promise((resolve) => {
      const writeOk = uploadInfo.stream.write(request.data, (writeErr?: Error | null) => {
        if (writeErr !== undefined && writeErr !== null) {
          this.cleanupUpload(request.transferId)
          resolve(err({
            code: 'SFTP_CHUNK_ERROR',
            message: writeErr.message,
            transferId: request.transferId
          }))
          return
        }

        uploadInfo.bytesWritten += request.data.length

        if (request.isLast) {
          // Close stdin to signal end of file
          uploadInfo.stream.end()
          this.uploadStreams.delete(request.transferId)
        }

        resolve(ok({
          transferId: request.transferId,
          chunkIndex: request.chunkIndex,
          bytesReceived: transfer.bytesTransferred
        }))
      })

      // If write returns false, the buffer is full - but we still wait for the callback
      if (!writeOk && !request.isLast) {
        // Backpressure: wait for drain before continuing
        uploadInfo.stream.once('drain', () => {
          // The write callback will still fire, so we don't resolve here
        })
      }
    })
  }

  completeUpload(transferId: TransferId): Result<SftpCompleteResponse, SftpServiceError> {
    const result = this.transferManager.completeTransfer(transferId)
    if (!result.ok) {
      return err({
        code: 'SFTP_INVALID_REQUEST',
        message: result.error.message,
        transferId
      })
    }

    this.cleanupUpload(transferId)
    logger('Upload completed (shell):', transferId)

    return ok({
      transferId,
      direction: 'upload',
      bytesTransferred: result.value.bytesTransferred,
      durationMs: result.value.durationMs,
      averageBytesPerSecond: result.value.averageBytesPerSecond
    })
  }

  cancelUpload(transferId: TransferId): Result<void, SftpServiceError> {
    this.cleanupUpload(transferId)
    this.transferManager.cancelTransfer(transferId)
    logger('Upload cancelled (shell):', transferId)
    return ok(undefined)
  }

  verifyTransferOwnership(
    transferId: TransferId,
    sessionId: SessionId
  ): Result<ManagedTransfer, TransferError> {
    return this.transferManager.verifyOwnership(transferId, sessionId)
  }

  async startDownload(
    request: DownloadStartRequest
  ): Promise<Result<SftpDownloadReadyResponse, SftpServiceError>> {
    const setup = await this.setupOperation({
      connectionId: request.connectionId,
      sessionId: request.sessionId,
      path: request.remotePath,
      checkExtension: true,
      transferId: request.transferId
    })
    if (!setup.ok) {
      return setup
    }

    const { client, resolvedPath } = setup.value

    // Stat the file to get size and verify it's a file
    const statCommand = buildStatCommand(resolvedPath)
    const statResult = await this.executeCommand(client, statCommand)
    if (!statResult.ok) {
      return err({
        ...statResult.error,
        transferId: request.transferId
      })
    }

    const fileInfo = parseStatEntry(statResult.value.stdout, resolvedPath)
    if (fileInfo === null) {
      return err({
        code: 'SFTP_NOT_FOUND',
        message: 'File not found',
        path: resolvedPath,
        transferId: request.transferId
      })
    }

    if (fileInfo.type !== 'file') {
      return err({
        code: 'SFTP_INVALID_REQUEST',
        message: 'Can only download files',
        path: resolvedPath,
        transferId: request.transferId
      })
    }

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
      return err(mapTransferStartError(transferResult.error, request.transferId))
    }

    this.transferManager.activateTransfer(request.transferId)
    logger('Download started (shell):', request.transferId, resolvedPath)

    return ok({
      transferId: request.transferId,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      mimeType: getMimeType(fileInfo.name)
    })
  }

  async streamDownloadChunks(
    connectionId: ConnectionId,
    transferId: TransferId,
    remotePath: string,
    _fileSize: number,
    callbacks: DownloadStreamCallbacks
  ): Promise<void> {
    const session = this.sessions.get(connectionId)
    if (session === undefined) {
      callbacks.onError({
        code: 'SFTP_NO_CONNECTION',
        message: 'Shell session not found',
        transferId
      })
      return
    }

    const client = this.deps.getSSHClient(connectionId)
    if (client === undefined) {
      callbacks.onError({
        code: 'SFTP_NO_CONNECTION',
        message: 'SSH client not found',
        transferId
      })
      return
    }

    const chunkSize = this.config.chunkSize
    const downloadState: DownloadState = { cancelled: false }
    this.downloadStates.set(transferId, downloadState)

    const escapedPath = escapeShellPath(remotePath)
    const catCommand = `cat ${escapedPath}`

    return new Promise((resolve) => {
      client.exec(catCommand, (execErr: Error | undefined, stream: ClientChannel) => {
        if (execErr !== undefined) {
          this.downloadStates.delete(transferId)
          this.transferManager.cancelTransfer(transferId)
          callbacks.onError({
            code: 'SFTP_PERMISSION_DENIED',
            message: execErr.message,
            path: remotePath,
            transferId
          })
          resolve()
          return
        }

        let chunkIndex = 0
        let buffer = Buffer.alloc(0)
        let lastProgressTime = Date.now()
        const progressInterval = SFTP_DEFAULTS.PROGRESS_INTERVAL_MS

        const emitChunk = (data: Buffer, isLast: boolean): void => {
          this.transferManager.updateProgress(transferId, chunkIndex, data.length)

          const base64Data = data.toString('base64')
          callbacks.onChunk({
            transferId,
            chunkIndex,
            data: base64Data,
            isLast
          })

          // Emit progress periodically
          const now = Date.now()
          if (now - lastProgressTime >= progressInterval) {
            lastProgressTime = now
            const progressResult = this.transferManager.getProgress(transferId)
            if (progressResult.ok) {
              callbacks.onProgress(progressResult.value)
            }
          }

          chunkIndex++
        }

        stream.on('data', (data: Buffer) => {
          if (downloadState.cancelled) {
            stream.destroy()
            return
          }

          // Accumulate data and emit in chunk-sized pieces
          buffer = Buffer.concat([buffer, data])

          while (buffer.length >= chunkSize) {
            const chunk = buffer.subarray(0, chunkSize)
            buffer = buffer.subarray(chunkSize)
            emitChunk(chunk, false)
          }
        })

        stream.on('end', () => {
          if (downloadState.cancelled) {
            return
          }

          // Emit remaining buffer as final chunk
          if (buffer.length > 0) {
            emitChunk(buffer, true)
          } else {
            // Edge case: file was an exact multiple of chunk size
            // The previous chunk should have been marked as last
            // Send an empty final chunk
            emitChunk(Buffer.alloc(0), true)
          }

          this.downloadStates.delete(transferId)
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
          logger('Download completed (shell):', transferId)
          resolve()
        })

        stream.on('error', (streamErr: Error) => {
          if (downloadState.cancelled) {
            resolve()
            return
          }

          this.downloadStates.delete(transferId)
          this.transferManager.cancelTransfer(transferId)
          callbacks.onError({
            code: 'SFTP_CHUNK_ERROR',
            message: streamErr.message,
            path: remotePath,
            transferId
          })
          resolve()
        })

        // Handle stderr (error output from cat)
        stream.stderr.on('data', (data: Buffer) => {
          const errorMessage = data.toString('utf8').trim()
          if (errorMessage !== '') {
            logger('Download stderr:', errorMessage)
          }
        })
      })
    })
  }

  cancelDownload(transferId: TransferId): Result<void, SftpServiceError> {
    const state = this.downloadStates.get(transferId)
    if (state !== undefined) {
      state.cancelled = true
      this.downloadStates.delete(transferId)
    }
    this.transferManager.cancelTransfer(transferId)
    logger('Download cancelled (shell):', transferId)
    return ok(undefined)
  }

  closeSession(connectionId: ConnectionId): void {
    this.sessions.delete(connectionId)
    logger('Shell session closed:', connectionId)
  }

  cancelSessionTransfers(sessionId: SessionId): void {
    this.transferManager.cancelSessionTransfers(sessionId)
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Common setup for all operations: validates config, path, session, and resolves tilde
   */
  private async setupOperation(options: {
    connectionId: ConnectionId
    sessionId: SessionId
    path: string
    checkExtension: boolean
    transferId?: TransferId
  }): Promise<Result<{ client: SSH2Client; resolvedPath: string }, SftpServiceError>> {
    if (!this.config.enabled) {
      return err({
        code: 'SFTP_NOT_ENABLED',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NOT_ENABLED],
        transferId: options.transferId
      })
    }

    // Validate path
    const pathResult = validatePath(options.path, getPathValidationOptions(this.config, options.checkExtension))
    if (!pathResult.ok) {
      return err({
        code: mapPathErrorCode(pathResult.error.code),
        message: pathResult.error.message,
        path: options.path,
        transferId: options.transferId
      })
    }

    // Get SSH client
    const client = this.deps.getSSHClient(options.connectionId)
    if (client === undefined) {
      return err({
        code: 'SFTP_NO_CONNECTION',
        message: SFTP_ERROR_MESSAGES[SFTP_ERROR_CODES.NO_CONNECTION],
        transferId: options.transferId
      })
    }

    // Ensure session exists
    this.ensureSession(options.connectionId, options.sessionId)

    // Resolve tilde paths
    const resolvedPath = await this.resolveTildePath(options.connectionId, client, pathResult.value)
    if (!resolvedPath.ok) {
      return err({ ...resolvedPath.error, transferId: options.transferId })
    }

    return ok({ client, resolvedPath: resolvedPath.value })
  }

  private ensureSession(connectionId: ConnectionId, sessionId: SessionId): void {
    if (!this.sessions.has(connectionId)) {
      this.sessions.set(connectionId, {
        connectionId,
        sessionId,
        homeDir: null,
        lastActivity: Date.now()
      })
    }
    const session = this.sessions.get(connectionId)
    if (session !== undefined) {
      session.lastActivity = Date.now()
    }
  }

  /**
   * Resolve tilde (~) in paths by executing `echo ~` on the remote.
   * Home directory is cached per session.
   */
  private async resolveTildePath(
    connectionId: ConnectionId,
    client: SSH2Client,
    path: string
  ): Promise<Result<string, SftpServiceError>> {
    if (path !== '~' && !path.startsWith('~/')) {
      return ok(path)
    }

    const session = this.sessions.get(connectionId)
    if (session === undefined) {
      return err({
        code: 'SFTP_NO_CONNECTION',
        message: 'Session not found'
      })
    }

    // Use cached home dir if available
    if (session.homeDir !== null) {
      const resolved = path === '~' ? session.homeDir : `${session.homeDir}/${path.slice(2)}`
      return ok(resolved)
    }

    // Resolve home directory via echo ~
    const command = buildHomeCommand()
    const result = await this.executeCommand(client, command)
    if (!result.ok) {
      return err(result.error)
    }

    const homeDir = resolveHomePath(result.value.stdout)
    if (homeDir === '' || !homeDir.startsWith('/')) {
      return err({
        code: 'SFTP_SESSION_ERROR',
        message: 'Failed to resolve home directory'
      })
    }

    session.homeDir = homeDir
    logger('Resolved home directory: %s', homeDir)

    const resolved = path === '~' ? homeDir : `${homeDir}/${path.slice(2)}`
    return ok(resolved)
  }

  /**
   * Execute a shell command and capture stdout/stderr.
   */
  private executeCommand(
    client: SSH2Client,
    command: string
  ): Promise<Result<{ stdout: string; stderr: string; code: number }, SftpServiceError>> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(err({
          code: 'SFTP_TIMEOUT',
          message: 'Command execution timeout'
        }))
      }, this.config.timeout)

      client.exec(command, (execErr: Error | undefined, stream: ClientChannel) => {
        if (execErr !== undefined) {
          clearTimeout(timeout)
          resolve(err(mapExecError(execErr)))
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (data: Buffer) => {
          stdout += data.toString('utf8')
        })

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString('utf8')
        })

        stream.on('close', (code: number) => {
          clearTimeout(timeout)

          if (code !== 0) {
            resolve(err(mapCommandError(stderr, code)))
            return
          }

          resolve(ok({ stdout, stderr, code }))
        })

        stream.on('error', (streamErr: Error) => {
          clearTimeout(timeout)
          resolve(err(mapExecError(streamErr)))
        })
      })
    })
  }

  private cleanupUpload(transferId: TransferId): void {
    const uploadInfo = this.uploadStreams.get(transferId)
    if (uploadInfo !== undefined) {
      try {
        uploadInfo.stream.destroy()
      } catch {
        // Ignore close errors
      }
      this.uploadStreams.delete(transferId)
    }
  }
}

/**
 * Map exec error to service error
 */
function mapExecError(error: Error): SftpServiceError {
  const message = error.message.toLowerCase()

  if (message.includes('permission denied') || message.includes('access denied')) {
    return {
      code: 'SFTP_PERMISSION_DENIED',
      message: 'Permission denied'
    }
  }

  return {
    code: 'SFTP_SESSION_ERROR',
    message: error.message
  }
}

/**
 * Map non-zero exit code and stderr to service error
 */
function mapCommandError(stderr: string, _code: number): SftpServiceError {
  const lower = stderr.toLowerCase()

  if (lower.includes('no such file') || lower.includes('not found') || lower.includes('cannot access')) {
    return {
      code: 'SFTP_NOT_FOUND',
      message: 'File or directory not found'
    }
  }

  if (lower.includes('permission denied') || lower.includes('access denied')) {
    return {
      code: 'SFTP_PERMISSION_DENIED',
      message: 'Permission denied'
    }
  }

  return {
    code: 'SFTP_SESSION_ERROR',
    message: stderr.trim() === '' ? 'Command failed' : stderr.trim()
  }
}

/**
 * Create a shell file service
 */
export function createShellFileService(
  config: SftpConfig,
  deps: SftpServiceDependencies
): ShellFileService {
  return new ShellFileService(config, deps)
}
