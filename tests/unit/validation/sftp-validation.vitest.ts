/**
 * SFTP Validation Unit Tests
 *
 * Tests for SFTP socket message validation, specifically for
 * server-side transfer ID generation security fix.
 *
 * @module tests/unit/validation/sftp-validation
 */

import { describe, it, expect } from 'vitest'
import {
  validateSftpUploadStartRequest,
  validateSftpDownloadStartRequest
} from '../../../app/validation/socket/sftp.js'

describe('sftp-validation', () => {
  describe('validateSftpUploadStartRequest', () => {
    it('validates request without transferId (server generates it)', () => {
      const result = validateSftpUploadStartRequest({
        remotePath: '/home/user/file.txt',
        fileName: 'file.txt',
        fileSize: 1000
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.remotePath).toBe('/home/user/file.txt')
        expect(result.value.fileName).toBe('file.txt')
        expect(result.value.fileSize).toBe(1000)
        // transferId should NOT be present in validated result
        expect('transferId' in result.value).toBe(false)
      }
    })

    it('ignores client-provided transferId (security: server generates)', () => {
      const result = validateSftpUploadStartRequest({
        transferId: 'client-provided-malicious-id',
        remotePath: '/home/user/file.txt',
        fileName: 'file.txt',
        fileSize: 1000
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Client-provided transferId should be ignored
        expect('transferId' in result.value).toBe(false)
      }
    })

    it('validates with optional mimeType', () => {
      const result = validateSftpUploadStartRequest({
        remotePath: '/home/user/file.txt',
        fileName: 'file.txt',
        fileSize: 1000,
        mimeType: 'text/plain'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.mimeType).toBe('text/plain')
      }
    })

    it('validates with optional overwrite', () => {
      const result = validateSftpUploadStartRequest({
        remotePath: '/home/user/file.txt',
        fileName: 'file.txt',
        fileSize: 1000,
        overwrite: true
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.overwrite).toBe(true)
      }
    })

    it('rejects missing remotePath', () => {
      const result = validateSftpUploadStartRequest({
        fileName: 'file.txt',
        fileSize: 1000
      })

      expect(result.ok).toBe(false)
    })

    it('rejects missing fileName', () => {
      const result = validateSftpUploadStartRequest({
        remotePath: '/home/user/file.txt',
        fileSize: 1000
      })

      expect(result.ok).toBe(false)
    })

    it('rejects missing fileSize', () => {
      const result = validateSftpUploadStartRequest({
        remotePath: '/home/user/file.txt',
        fileName: 'file.txt'
      })

      expect(result.ok).toBe(false)
    })

    it('rejects fileSize exceeding maxFileSize', () => {
      const result = validateSftpUploadStartRequest(
        {
          remotePath: '/home/user/file.txt',
          fileName: 'file.txt',
          fileSize: 200 * 1024 * 1024 // 200MB
        },
        { maxFileSize: 100 * 1024 * 1024 } // 100MB max
      )

      expect(result.ok).toBe(false)
    })
  })

  describe('validateSftpDownloadStartRequest', () => {
    it('validates request without transferId (server generates it)', () => {
      const result = validateSftpDownloadStartRequest({
        remotePath: '/home/user/file.txt'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.remotePath).toBe('/home/user/file.txt')
        // transferId should NOT be present in validated result
        expect('transferId' in result.value).toBe(false)
      }
    })

    it('ignores client-provided transferId (security: server generates)', () => {
      const result = validateSftpDownloadStartRequest({
        transferId: 'client-provided-malicious-id',
        remotePath: '/home/user/file.txt'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Client-provided transferId should be ignored
        expect('transferId' in result.value).toBe(false)
      }
    })

    it('rejects missing remotePath', () => {
      const result = validateSftpDownloadStartRequest({})

      expect(result.ok).toBe(false)
    })

    it('rejects empty remotePath', () => {
      const result = validateSftpDownloadStartRequest({
        remotePath: ''
      })

      expect(result.ok).toBe(false)
    })
  })
})
