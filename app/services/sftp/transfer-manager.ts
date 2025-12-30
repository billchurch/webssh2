/**
 * Transfer Manager for SFTP Operations
 *
 * Tracks active uploads and downloads with:
 * - Progress tracking
 * - Rate limiting integration
 * - Concurrent transfer limits
 * - Transfer state management
 *
 * @module services/sftp/transfer-manager
 */

import type { TransferId, SessionId } from '../../types/branded.js'
import type { Transfer, TransferDirection } from '../../types/contracts/v1/sftp.js'
import { createRateLimiter, type RateLimiter } from './rate-limiter.js'
import { ok, err } from '../../utils/result.js'
import type { Result } from '../../types/result.js'

/**
 * Transfer manager error
 */
export interface TransferError {
  readonly code: 'TRANSFER_NOT_FOUND' | 'MAX_TRANSFERS' | 'INVALID_STATE' | 'CHUNK_MISMATCH'
  readonly message: string
  readonly transferId?: TransferId
}

/**
 * Parameters for starting a new transfer
 */
export interface StartTransferParams {
  readonly transferId: TransferId
  readonly sessionId: SessionId
  readonly direction: TransferDirection
  readonly remotePath: string
  readonly fileName: string
  readonly totalBytes: number
  readonly rateLimitBytesPerSec?: number
}

/**
 * Transfer with rate limiter
 */
export interface ManagedTransfer extends Transfer {
  /** Rate limiter for this transfer */
  rateLimiter: RateLimiter
}

/**
 * Transfer progress info
 */
export interface TransferProgress {
  readonly transferId: TransferId
  readonly direction: TransferDirection
  readonly bytesTransferred: number
  readonly totalBytes: number
  readonly percentComplete: number
  readonly bytesPerSecond: number
  readonly estimatedSecondsRemaining: number | null
}

/**
 * Transfer completion info
 */
export interface TransferCompletion {
  readonly transferId: TransferId
  readonly direction: TransferDirection
  readonly bytesTransferred: number
  readonly durationMs: number
  readonly averageBytesPerSecond: number
}

/**
 * Transfer Manager
 *
 * Manages active file transfers for a session, enforcing concurrent limits
 * and tracking progress.
 */
export class TransferManager {
  private readonly transfers = new Map<TransferId, ManagedTransfer>()
  private readonly maxConcurrent: number
  private readonly defaultRateLimitBytesPerSec: number

  constructor(options: {
    maxConcurrentTransfers: number
    defaultRateLimitBytesPerSec?: number
  }) {
    this.maxConcurrent = options.maxConcurrentTransfers
    this.defaultRateLimitBytesPerSec = options.defaultRateLimitBytesPerSec ?? 0
  }

  /**
   * Start tracking a new transfer
   */
  startTransfer(params: StartTransferParams): Result<ManagedTransfer, TransferError> {
    // Check concurrent limit
    const activeCount = this.getActiveCount(params.sessionId)
    if (activeCount >= this.maxConcurrent) {
      return err({
        code: 'MAX_TRANSFERS',
        message: `Maximum concurrent transfers (${this.maxConcurrent}) reached`,
        transferId: params.transferId
      })
    }

    // Check if transfer already exists
    if (this.transfers.has(params.transferId)) {
      return err({
        code: 'INVALID_STATE',
        message: 'Transfer already exists',
        transferId: params.transferId
      })
    }

    const now = Date.now()
    const rateLimitBytesPerSec = params.rateLimitBytesPerSec ?? this.defaultRateLimitBytesPerSec

    const transfer: ManagedTransfer = {
      id: params.transferId,
      sessionId: params.sessionId,
      direction: params.direction,
      remotePath: params.remotePath,
      fileName: params.fileName,
      totalBytes: params.totalBytes,
      bytesTransferred: 0,
      startedAt: now,
      lastChunkAt: now,
      status: 'pending',
      nextChunkIndex: 0,
      rateLimiter: createRateLimiter(rateLimitBytesPerSec)
    }

    this.transfers.set(params.transferId, transfer)
    return ok(transfer)
  }

  /**
   * Mark transfer as active
   */
  activateTransfer(transferId: TransferId): Result<ManagedTransfer, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    if (transfer.status !== 'pending') {
      return err({
        code: 'INVALID_STATE',
        message: `Cannot activate transfer in ${transfer.status} state`,
        transferId
      })
    }

    transfer.status = 'active'
    transfer.lastChunkAt = Date.now()
    return ok(transfer)
  }

  /**
   * Update transfer progress with a chunk
   *
   * @param transferId - Transfer ID
   * @param chunkIndex - Expected chunk index
   * @param bytesReceived - Bytes in this chunk
   * @returns Updated transfer or error
   */
  updateProgress(
    transferId: TransferId,
    chunkIndex: number,
    bytesReceived: number
  ): Result<ManagedTransfer, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    if (transfer.status !== 'active') {
      return err({
        code: 'INVALID_STATE',
        message: `Cannot update transfer in ${transfer.status} state`,
        transferId
      })
    }

    // Validate chunk order
    if (chunkIndex !== transfer.nextChunkIndex) {
      return err({
        code: 'CHUNK_MISMATCH',
        message: `Expected chunk ${transfer.nextChunkIndex}, got ${chunkIndex}`,
        transferId
      })
    }

    // Update transfer state
    transfer.bytesTransferred += bytesReceived
    transfer.lastChunkAt = Date.now()
    transfer.nextChunkIndex = chunkIndex + 1

    // Update rate limiter
    transfer.rateLimiter.checkAndUpdate(bytesReceived)

    return ok(transfer)
  }

  /**
   * Get current progress for a transfer
   */
  getProgress(transferId: TransferId): Result<TransferProgress, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    const bytesPerSecond = transfer.rateLimiter.calculateCurrentRate()
    const percentComplete = transfer.totalBytes > 0
      ? Math.floor((transfer.bytesTransferred * 100) / transfer.totalBytes)
      : 0

    const remainingBytes = transfer.totalBytes - transfer.bytesTransferred
    const estimatedSecondsRemaining = bytesPerSecond > 0
      ? Math.ceil(remainingBytes / bytesPerSecond)
      : null

    return ok({
      transferId: transfer.id,
      direction: transfer.direction,
      bytesTransferred: transfer.bytesTransferred,
      totalBytes: transfer.totalBytes,
      percentComplete,
      bytesPerSecond,
      estimatedSecondsRemaining
    })
  }

  /**
   * Mark transfer as completed
   */
  completeTransfer(transferId: TransferId): Result<TransferCompletion, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    const durationMs = transfer.rateLimiter.getElapsedMs()
    const averageBytesPerSecond = durationMs > 0
      ? Math.floor((transfer.bytesTransferred * 1000) / durationMs)
      : 0

    transfer.status = 'completed'

    const completion: TransferCompletion = {
      transferId: transfer.id,
      direction: transfer.direction,
      bytesTransferred: transfer.bytesTransferred,
      durationMs,
      averageBytesPerSecond
    }

    // Remove completed transfer
    this.transfers.delete(transferId)

    return ok(completion)
  }

  /**
   * Cancel a transfer
   */
  cancelTransfer(transferId: TransferId): Result<void, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      // Already gone, that's fine
      return ok(undefined)
    }

    transfer.status = 'cancelled'
    this.transfers.delete(transferId)
    return ok(undefined)
  }

  /**
   * Mark transfer as failed
   */
  failTransfer(transferId: TransferId, _reason: string): Result<void, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    transfer.status = 'failed'
    this.transfers.delete(transferId)
    return ok(undefined)
  }

  /**
   * Pause a transfer
   */
  pauseTransfer(transferId: TransferId): Result<void, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    if (transfer.status !== 'active') {
      return err({
        code: 'INVALID_STATE',
        message: `Cannot pause transfer in ${transfer.status} state`,
        transferId
      })
    }

    transfer.status = 'paused'
    transfer.rateLimiter.pause()
    return ok(undefined)
  }

  /**
   * Resume a paused transfer
   */
  resumeTransfer(transferId: TransferId): Result<void, TransferError> {
    const transfer = this.transfers.get(transferId)
    if (transfer === undefined) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    if (transfer.status !== 'paused') {
      return err({
        code: 'INVALID_STATE',
        message: `Cannot resume transfer in ${transfer.status} state`,
        transferId
      })
    }

    transfer.status = 'active'
    transfer.rateLimiter.resume()
    return ok(undefined)
  }

  /**
   * Get a transfer by ID
   */
  getTransfer(transferId: TransferId): ManagedTransfer | undefined {
    return this.transfers.get(transferId)
  }

  /**
   * Verify that a session owns a transfer.
   *
   * Returns TRANSFER_NOT_FOUND for both missing transfers AND wrong-session
   * to prevent enumeration attacks (attackers cannot discover valid transfer IDs
   * by observing different error codes).
   */
  verifyOwnership(
    transferId: TransferId,
    sessionId: SessionId
  ): Result<ManagedTransfer, TransferError> {
    const transfer = this.transfers.get(transferId)

    // Same error for not found AND wrong session (security: prevents enumeration)
    // Note: optional chain works because sessionId is never undefined
    if (transfer?.sessionId !== sessionId) {
      return err({
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transfer not found',
        transferId
      })
    }

    return ok(transfer)
  }

  /**
   * Get active transfer count for a session
   */
  getActiveCount(sessionId: SessionId): number {
    let count = 0
    for (const transfer of this.transfers.values()) {
      if (transfer.sessionId === sessionId &&
          (transfer.status === 'pending' || transfer.status === 'active')) {
        count++
      }
    }
    return count
  }

  /**
   * Check if a new transfer can be started
   */
  canStartTransfer(sessionId: SessionId): boolean {
    return this.getActiveCount(sessionId) < this.maxConcurrent
  }

  /**
   * Get all transfers for a session
   */
  getSessionTransfers(sessionId: SessionId): ManagedTransfer[] {
    const transfers: ManagedTransfer[] = []
    for (const transfer of this.transfers.values()) {
      if (transfer.sessionId === sessionId) {
        transfers.push(transfer)
      }
    }
    return transfers
  }

  /**
   * Cancel all transfers for a session
   */
  cancelSessionTransfers(sessionId: SessionId): void {
    for (const transfer of this.transfers.values()) {
      if (transfer.sessionId === sessionId) {
        this.transfers.delete(transfer.id)
      }
    }
  }

  /**
   * Get total transfer count
   */
  getTotalCount(): number {
    return this.transfers.size
  }

  /**
   * Clear all transfers
   */
  clear(): void {
    this.transfers.clear()
  }
}

/**
 * Create a new transfer manager
 */
export function createTransferManager(options: {
  maxConcurrentTransfers: number
  defaultRateLimitBytesPerSec?: number
}): TransferManager {
  return new TransferManager(options)
}
