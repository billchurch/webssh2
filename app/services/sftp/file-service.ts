/**
 * FileService Interface
 *
 * Defines the contract for file operations that both the SFTP backend
 * and the shell-command backend implement. The socket adapter depends
 * only on this interface, making the backend selection transparent.
 *
 * @module services/sftp/file-service
 */

import type { ConnectionId, SessionId, TransferId } from '../../types/branded.js'
import type { Result } from '../../types/result.js'
import type {
  SftpDirectoryResponse,
  SftpStatResponse,
  SftpOperationResponse,
  SftpUploadReadyResponse,
  SftpUploadAckResponse,
  SftpDownloadReadyResponse,
  SftpCompleteResponse
} from '../../types/contracts/v1/sftp.js'
import type {
  SftpServiceError,
  UploadStartRequest,
  UploadChunkRequest,
  DownloadStartRequest,
  DownloadStreamCallbacks
} from './sftp-service.js'
import type { ManagedTransfer, TransferError } from './transfer-manager.js'

/**
 * FileService interface
 *
 * Both SftpService and ShellFileService implement this interface.
 * The socket adapter uses this to perform file operations regardless
 * of the underlying transport (SFTP subsystem or shell commands).
 */
export interface FileService {
  /** Check if the file service is enabled */
  isEnabled(): boolean

  /** List directory contents */
  listDirectory(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string,
    showHidden?: boolean
  ): Promise<Result<SftpDirectoryResponse, SftpServiceError>>

  /** Get file/directory information */
  stat(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string
  ): Promise<Result<SftpStatResponse, SftpServiceError>>

  /** Create a directory */
  mkdir(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string,
    mode?: number
  ): Promise<Result<SftpOperationResponse, SftpServiceError>>

  /** Delete a file or directory */
  delete(
    connectionId: ConnectionId,
    sessionId: SessionId,
    path: string,
    recursive?: boolean
  ): Promise<Result<SftpOperationResponse, SftpServiceError>>

  /** Start an upload */
  startUpload(
    request: UploadStartRequest
  ): Promise<Result<SftpUploadReadyResponse, SftpServiceError>>

  /** Process an upload chunk */
  processUploadChunk(
    request: UploadChunkRequest
  ): Promise<Result<SftpUploadAckResponse, SftpServiceError>>

  /** Complete an upload */
  completeUpload(
    transferId: TransferId
  ): Result<SftpCompleteResponse, SftpServiceError>

  /** Cancel an upload */
  cancelUpload(
    transferId: TransferId
  ): Result<void, SftpServiceError>

  /** Verify that a session owns a transfer */
  verifyTransferOwnership(
    transferId: TransferId,
    sessionId: SessionId
  ): Result<ManagedTransfer, TransferError>

  /** Start a download */
  startDownload(
    request: DownloadStartRequest
  ): Promise<Result<SftpDownloadReadyResponse, SftpServiceError>>

  /** Stream download chunks to client */
  streamDownloadChunks(
    connectionId: ConnectionId,
    transferId: TransferId,
    remotePath: string,
    fileSize: number,
    callbacks: DownloadStreamCallbacks
  ): Promise<void>

  /** Cancel a download */
  cancelDownload(
    transferId: TransferId
  ): Result<void, SftpServiceError>

  /** Close session for a connection */
  closeSession(connectionId: ConnectionId): void

  /** Cancel all transfers for a session */
  cancelSessionTransfers(sessionId: SessionId): void
}
