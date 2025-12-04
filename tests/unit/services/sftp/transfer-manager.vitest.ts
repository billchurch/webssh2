/**
 * Transfer Manager Unit Tests
 *
 * Tests for SFTP transfer tracking and management.
 *
 * @module tests/unit/services/sftp/transfer-manager
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TransferManager,
  createTransferManager
} from '../../../../app/services/sftp/transfer-manager.js'
import { createTransferId, createSessionId } from '../../../../app/types/branded.js'

describe('transfer-manager', () => {
  const sessionId = createSessionId('test-session-1')
  const transferId = createTransferId('test-transfer-1')

  describe('TransferManager', () => {
    let manager: TransferManager

    beforeEach(() => {
      manager = new TransferManager({
        maxConcurrentTransfers: 2,
        defaultRateLimitBytesPerSec: 0
      })
    })

    describe('startTransfer', () => {
      it('creates a new transfer', () => {
        const result = manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/home/user/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.id).toBe(transferId)
          expect(result.value.status).toBe('pending')
          expect(result.value.bytesTransferred).toBe(0)
        }
      })

      it('rejects duplicate transfer IDs', () => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/home/user/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })

        const result = manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/home/user/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 2000
        })

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_STATE')
        }
      })

      it('enforces concurrent transfer limit', () => {
        // Start two transfers (max)
        manager.startTransfer({
          transferId: createTransferId('t1'),
          sessionId,
          direction: 'upload',
          remotePath: '/file1.txt',
          fileName: 'file1.txt',
          totalBytes: 100
        })
        manager.startTransfer({
          transferId: createTransferId('t2'),
          sessionId,
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 100
        })

        // Third should fail
        const result = manager.startTransfer({
          transferId: createTransferId('t3'),
          sessionId,
          direction: 'upload',
          remotePath: '/file3.txt',
          fileName: 'file3.txt',
          totalBytes: 100
        })

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('MAX_TRANSFERS')
        }
      })

      it('allows transfers for different sessions', () => {
        const session2 = createSessionId('test-session-2')

        manager.startTransfer({
          transferId: createTransferId('t1'),
          sessionId,
          direction: 'upload',
          remotePath: '/file1.txt',
          fileName: 'file1.txt',
          totalBytes: 100
        })
        manager.startTransfer({
          transferId: createTransferId('t2'),
          sessionId,
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 100
        })

        // Different session should work
        const result = manager.startTransfer({
          transferId: createTransferId('t3'),
          sessionId: session2,
          direction: 'upload',
          remotePath: '/file3.txt',
          fileName: 'file3.txt',
          totalBytes: 100
        })

        expect(result.ok).toBe(true)
      })
    })

    describe('activateTransfer', () => {
      it('activates a pending transfer', () => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })

        const result = manager.activateTransfer(transferId)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.status).toBe('active')
        }
      })

      it('rejects activating non-existent transfer', () => {
        const result = manager.activateTransfer(createTransferId('unknown'))
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('TRANSFER_NOT_FOUND')
        }
      })

      it('rejects activating non-pending transfer', () => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })
        manager.activateTransfer(transferId)

        // Try to activate again
        const result = manager.activateTransfer(transferId)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_STATE')
        }
      })
    })

    describe('updateProgress', () => {
      beforeEach(() => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })
        manager.activateTransfer(transferId)
      })

      it('updates bytes transferred', () => {
        const result = manager.updateProgress(transferId, 0, 100)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.bytesTransferred).toBe(100)
        }
      })

      it('accumulates progress', () => {
        manager.updateProgress(transferId, 0, 100)
        manager.updateProgress(transferId, 1, 150)
        const result = manager.updateProgress(transferId, 2, 200)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.bytesTransferred).toBe(450)
        }
      })

      it('validates chunk order', () => {
        // Skip chunk 0
        const result = manager.updateProgress(transferId, 1, 100)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('CHUNK_MISMATCH')
        }
      })

      it('rejects progress on non-active transfer', () => {
        manager.startTransfer({
          transferId: createTransferId('pending'),
          sessionId,
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 1000
        })

        const result = manager.updateProgress(createTransferId('pending'), 0, 100)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_STATE')
        }
      })
    })

    describe('getProgress', () => {
      it('returns transfer progress', () => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'download',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })
        manager.activateTransfer(transferId)
        manager.updateProgress(transferId, 0, 500)

        const result = manager.getProgress(transferId)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.bytesTransferred).toBe(500)
          expect(result.value.totalBytes).toBe(1000)
          expect(result.value.percentComplete).toBe(50)
        }
      })

      it('returns error for unknown transfer', () => {
        const result = manager.getProgress(createTransferId('unknown'))
        expect(result.ok).toBe(false)
      })
    })

    describe('completeTransfer', () => {
      it('completes and removes transfer', () => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })
        manager.activateTransfer(transferId)
        manager.updateProgress(transferId, 0, 1000)

        const result = manager.completeTransfer(transferId)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.bytesTransferred).toBe(1000)
        }

        // Transfer should be removed
        expect(manager.getTransfer(transferId)).toBeUndefined()
      })
    })

    describe('cancelTransfer', () => {
      it('cancels and removes transfer', () => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })

        const result = manager.cancelTransfer(transferId)
        expect(result.ok).toBe(true)
        expect(manager.getTransfer(transferId)).toBeUndefined()
      })

      it('succeeds even for non-existent transfer', () => {
        const result = manager.cancelTransfer(createTransferId('unknown'))
        expect(result.ok).toBe(true)
      })
    })

    describe('pauseTransfer / resumeTransfer', () => {
      beforeEach(() => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 1000
        })
        manager.activateTransfer(transferId)
      })

      it('pauses an active transfer', () => {
        const result = manager.pauseTransfer(transferId)
        expect(result.ok).toBe(true)

        const transfer = manager.getTransfer(transferId)
        expect(transfer?.status).toBe('paused')
      })

      it('resumes a paused transfer', () => {
        manager.pauseTransfer(transferId)
        const result = manager.resumeTransfer(transferId)
        expect(result.ok).toBe(true)

        const transfer = manager.getTransfer(transferId)
        expect(transfer?.status).toBe('active')
      })

      it('cannot pause non-active transfer', () => {
        manager.pauseTransfer(transferId)
        const result = manager.pauseTransfer(transferId)
        expect(result.ok).toBe(false)
      })

      it('cannot resume non-paused transfer', () => {
        const result = manager.resumeTransfer(transferId)
        expect(result.ok).toBe(false)
      })
    })

    describe('getActiveCount', () => {
      it('counts pending and active transfers', () => {
        expect(manager.getActiveCount(sessionId)).toBe(0)

        manager.startTransfer({
          transferId: createTransferId('t1'),
          sessionId,
          direction: 'upload',
          remotePath: '/file1.txt',
          fileName: 'file1.txt',
          totalBytes: 100
        })
        expect(manager.getActiveCount(sessionId)).toBe(1)

        manager.startTransfer({
          transferId: createTransferId('t2'),
          sessionId,
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 100
        })
        expect(manager.getActiveCount(sessionId)).toBe(2)
      })

      it('does not count completed transfers', () => {
        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 100
        })
        manager.activateTransfer(transferId)
        manager.completeTransfer(transferId)

        expect(manager.getActiveCount(sessionId)).toBe(0)
      })
    })

    describe('cancelSessionTransfers', () => {
      it('cancels all transfers for a session', () => {
        manager.startTransfer({
          transferId: createTransferId('t1'),
          sessionId,
          direction: 'upload',
          remotePath: '/file1.txt',
          fileName: 'file1.txt',
          totalBytes: 100
        })
        manager.startTransfer({
          transferId: createTransferId('t2'),
          sessionId,
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 100
        })

        manager.cancelSessionTransfers(sessionId)

        expect(manager.getActiveCount(sessionId)).toBe(0)
        expect(manager.getTotalCount()).toBe(0)
      })

      it('does not affect other sessions', () => {
        const session2 = createSessionId('session-2')

        manager.startTransfer({
          transferId: createTransferId('t1'),
          sessionId,
          direction: 'upload',
          remotePath: '/file1.txt',
          fileName: 'file1.txt',
          totalBytes: 100
        })
        manager.startTransfer({
          transferId: createTransferId('t2'),
          sessionId: session2,
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 100
        })

        manager.cancelSessionTransfers(sessionId)

        expect(manager.getActiveCount(sessionId)).toBe(0)
        expect(manager.getActiveCount(session2)).toBe(1)
      })
    })

    describe('canStartTransfer', () => {
      it('returns true when under limit', () => {
        expect(manager.canStartTransfer(sessionId)).toBe(true)

        manager.startTransfer({
          transferId,
          sessionId,
          direction: 'upload',
          remotePath: '/file.txt',
          fileName: 'file.txt',
          totalBytes: 100
        })

        expect(manager.canStartTransfer(sessionId)).toBe(true)
      })

      it('returns false when at limit', () => {
        manager.startTransfer({
          transferId: createTransferId('t1'),
          sessionId,
          direction: 'upload',
          remotePath: '/file1.txt',
          fileName: 'file1.txt',
          totalBytes: 100
        })
        manager.startTransfer({
          transferId: createTransferId('t2'),
          sessionId,
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 100
        })

        expect(manager.canStartTransfer(sessionId)).toBe(false)
      })
    })

    describe('clear', () => {
      it('removes all transfers', () => {
        manager.startTransfer({
          transferId: createTransferId('t1'),
          sessionId,
          direction: 'upload',
          remotePath: '/file1.txt',
          fileName: 'file1.txt',
          totalBytes: 100
        })
        manager.startTransfer({
          transferId: createTransferId('t2'),
          sessionId: createSessionId('session-2'),
          direction: 'upload',
          remotePath: '/file2.txt',
          fileName: 'file2.txt',
          totalBytes: 100
        })

        manager.clear()

        expect(manager.getTotalCount()).toBe(0)
      })
    })
  })

  describe('createTransferManager', () => {
    it('creates a manager with specified options', () => {
      const manager = createTransferManager({
        maxConcurrentTransfers: 5,
        defaultRateLimitBytesPerSec: 1000
      })

      expect(manager).toBeInstanceOf(TransferManager)
    })
  })
})
