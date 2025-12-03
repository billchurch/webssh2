/**
 * Path Validator Unit Tests
 *
 * Tests for SFTP path validation, normalization, and security checks.
 *
 * @module tests/unit/services/sftp/path-validator
 */

import { describe, it, expect } from 'vitest'
import {
  validatePath,
  validateFileName,
  normalizePath,
  joinPathSafely,
  type PathValidationOptions
} from '../../../../app/services/sftp/path-validator.js'
import { SFTP_LIMITS } from '../../../../app/constants/sftp.js'

describe('path-validator', () => {
  describe('normalizePath', () => {
    it('normalizes simple paths', () => {
      expect(normalizePath('/home/user')).toBe('/home/user')
      // Note: pathPosix.normalize preserves trailing slash
      expect(normalizePath('/home/user/')).toBe('/home/user/')
      expect(normalizePath('/home//user')).toBe('/home/user')
    })

    it('handles relative components', () => {
      expect(normalizePath('/home/user/../admin')).toBe('/home/admin')
      expect(normalizePath('/home/./user')).toBe('/home/user')
      expect(normalizePath('/home/user/./files/..')).toBe('/home/user')
    })

    it('handles empty and dot paths', () => {
      expect(normalizePath('')).toBe('.')
      expect(normalizePath('.')).toBe('.')
    })

    it('handles home directory paths', () => {
      expect(normalizePath('~')).toBe('~')
      expect(normalizePath('~/')).toBe('~')
      expect(normalizePath('~/files')).toBe('~/files')
      expect(normalizePath('~/files/../documents')).toBe('~/documents')
    })
  })

  describe('validatePath', () => {
    const defaultOptions: PathValidationOptions = {
      allowedPaths: null,
      blockedExtensions: [],
      checkExtension: false
    }

    it('validates simple paths', () => {
      const result = validatePath('/home/user/file.txt', defaultOptions)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('/home/user/file.txt')
      }
    })

    it('normalizes paths', () => {
      const result = validatePath('/home/user/../admin/file.txt', defaultOptions)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('/home/admin/file.txt')
      }
    })

    it('rejects paths with null bytes', () => {
      const result = validatePath('/home/user\0/file.txt', defaultOptions)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_PATH')
      }
    })

    it('rejects paths that are too long', () => {
      const longPath = `/${'a'.repeat(SFTP_LIMITS.MAX_PATH_LENGTH + 1)}`
      const result = validatePath(longPath, defaultOptions)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TOO_LONG')
      }
    })

    it('detects path traversal attempts', () => {
      const result = validatePath('../../../etc/passwd', defaultOptions)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TRAVERSAL')
      }
    })

    describe('allowed paths', () => {
      const restrictedOptions: PathValidationOptions = {
        allowedPaths: ['/home', '/tmp'],
        blockedExtensions: [],
        checkExtension: false
      }

      it('allows paths within allowed directories', () => {
        const result = validatePath('/home/user/file.txt', restrictedOptions)
        expect(result.ok).toBe(true)
      })

      it('allows exact match of allowed paths', () => {
        const result = validatePath('/home', restrictedOptions)
        expect(result.ok).toBe(true)
      })

      it('rejects paths outside allowed directories', () => {
        const result = validatePath('/etc/passwd', restrictedOptions)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('PATH_FORBIDDEN')
        }
      })

      it('handles home directory with allowed ~ path', () => {
        const homeOptions: PathValidationOptions = {
          allowedPaths: ['~', '/tmp'],
          blockedExtensions: [],
          checkExtension: false
        }
        const result = validatePath('~/documents/file.txt', homeOptions)
        expect(result.ok).toBe(true)
      })
    })

    describe('blocked extensions', () => {
      const extensionOptions: PathValidationOptions = {
        allowedPaths: null,
        blockedExtensions: ['.exe', '.dll', '.sh'],
        checkExtension: true
      }

      it('allows files with non-blocked extensions', () => {
        const result = validatePath('/home/user/file.txt', extensionOptions)
        expect(result.ok).toBe(true)
      })

      it('blocks files with blocked extensions', () => {
        const result = validatePath('/home/user/virus.exe', extensionOptions)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('EXTENSION_BLOCKED')
        }
      })

      it('handles case-insensitive extension matching', () => {
        const result = validatePath('/home/user/file.EXE', extensionOptions)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('EXTENSION_BLOCKED')
        }
      })

      it('allows files without extension', () => {
        const result = validatePath('/home/user/Makefile', extensionOptions)
        expect(result.ok).toBe(true)
      })

      it('skips extension check when checkExtension is false', () => {
        const noCheckOptions: PathValidationOptions = {
          allowedPaths: null,
          blockedExtensions: ['.exe'],
          checkExtension: false
        }
        const result = validatePath('/home/user/file.exe', noCheckOptions)
        expect(result.ok).toBe(true)
      })

      it('handles extensions without leading dots', () => {
        const noDotOptions: PathValidationOptions = {
          allowedPaths: null,
          blockedExtensions: ['exe', 'dll', 'sh'],
          checkExtension: true
        }
        const result = validatePath('/home/user/virus.exe', noDotOptions)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.code).toBe('EXTENSION_BLOCKED')
        }
      })

      it('handles mixed extensions with and without dots', () => {
        const mixedOptions: PathValidationOptions = {
          allowedPaths: null,
          blockedExtensions: ['exe', '.dll', 'sh'],
          checkExtension: true
        }
        const result1 = validatePath('/home/user/file.exe', mixedOptions)
        expect(result1.ok).toBe(false)

        const result2 = validatePath('/home/user/file.dll', mixedOptions)
        expect(result2.ok).toBe(false)

        const result3 = validatePath('/home/user/script.sh', mixedOptions)
        expect(result3.ok).toBe(false)

        const result4 = validatePath('/home/user/file.txt', mixedOptions)
        expect(result4.ok).toBe(true)
      })
    })
  })

  describe('validateFileName', () => {
    it('validates simple filenames', () => {
      const result = validateFileName('file.txt')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('file.txt')
      }
    })

    it('rejects filenames with null bytes', () => {
      const result = validateFileName('file\0.txt')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_PATH')
      }
    })

    it('rejects filenames that are too long', () => {
      const longName = 'a'.repeat(SFTP_LIMITS.MAX_FILENAME_LENGTH + 1)
      const result = validateFileName(longName)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TOO_LONG')
      }
    })

    it('rejects filenames with path separators', () => {
      const result1 = validateFileName('path/file.txt')
      expect(result1.ok).toBe(false)

      const result2 = validateFileName('path\\file.txt')
      expect(result2.ok).toBe(false)
    })

    it('rejects reserved names', () => {
      expect(validateFileName('.').ok).toBe(false)
      expect(validateFileName('..').ok).toBe(false)
    })

    it('allows hidden files', () => {
      const result = validateFileName('.gitignore')
      expect(result.ok).toBe(true)
    })
  })

  describe('joinPathSafely', () => {
    it('joins simple paths', () => {
      const result = joinPathSafely('/home/user', 'files/doc.txt')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('/home/user/files/doc.txt')
      }
    })

    it('rejects absolute relative paths', () => {
      const result = joinPathSafely('/home/user', '/etc/passwd')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TRAVERSAL')
      }
    })

    it('rejects parent directory escape', () => {
      const result = joinPathSafely('/home/user', '../admin/files')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('PATH_TRAVERSAL')
      }
    })

    it('handles home directory base', () => {
      const result = joinPathSafely('~', 'documents/file.txt')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('~/documents/file.txt')
      }
    })

    it('handles current directory base', () => {
      const result = joinPathSafely('.', 'files/doc.txt')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('files/doc.txt')
      }
    })
  })
})
