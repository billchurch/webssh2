// tests/unit/utils/credential-extractor.vitest.ts
// Tests for credential extraction functions

import { describe, it, expect } from 'vitest'
import {
  extractAuthCredentials,
  extractOptionalTerminalSettings,
  validateRequiredFields,
  extractAuthMethod,
  convertToAuthCredentials,
  CredentialError
} from '../../../app/utils/credential-extractor.js'
import {
  TEST_USERNAME,
  TEST_PASSWORD,
  TEST_PASSWORDS,
  TEST_PRIVATE_KEY,
  TEST_PASSPHRASE,
  TEST_SSH,
  TEST_IPS,
  TERMINAL
} from '../../test-constants.js'

describe('Credential Extractor', () => {
  describe('validateRequiredFields', () => {
    it('should validate all required fields', () => {
      const result = validateRequiredFields({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual({
          username: TEST_USERNAME,
          host: TEST_SSH.HOST,
          port: TEST_SSH.PORT
        })
      }
    })

    it('should use default port 22 when not provided', () => {
      const result = validateRequiredFields({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.port).toBe(22)
      }
    })

    it('should reject missing username', () => {
      const result = validateRequiredFields({
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(CredentialError)
        expect(result.error.message).toContain('Username')
        expect(result.error.field).toBe('username')
      }
    })

    it('should reject empty username', () => {
      const result = validateRequiredFields({
        username: '',
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.field).toBe('username')
      }
    })

    it('should reject non-string username', () => {
      const result = validateRequiredFields({
        username: 123,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.field).toBe('username')
      }
    })

    it('should reject missing host', () => {
      const result = validateRequiredFields({
        username: TEST_USERNAME,
        port: TEST_SSH.PORT
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Host')
        expect(result.error.field).toBe('host')
      }
    })

    it('should reject empty host', () => {
      const result = validateRequiredFields({
        username: TEST_USERNAME,
        host: '',
        port: TEST_SSH.PORT
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.field).toBe('host')
      }
    })

    it('should use default port for null and undefined', () => {
      const result1 = validateRequiredFields({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: null
      })

      expect(result1.ok).toBe(true)
      if (result1.ok) {
        expect(result1.value.port).toBe(22)
      }

      const result2 = validateRequiredFields({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: undefined
      })

      expect(result2.ok).toBe(true)
      if (result2.ok) {
        expect(result2.value.port).toBe(22)
      }
    })

    it('should reject invalid port numbers', () => {
      const invalidPorts = [0, -1, 65536, 99999, 'not-a-number']

      for (const port of invalidPorts) {
        const result = validateRequiredFields({
          username: TEST_USERNAME,
          host: TEST_SSH.HOST,
          port
        })

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error.field).toBe('port')
        }
      }
    })
  })

  describe('extractAuthMethod', () => {
    it('should detect password authentication', () => {
      const method = extractAuthMethod({
        password: TEST_PASSWORD
      })
      expect(method).toBe('password')
    })

    it('should detect privateKey authentication', () => {
      const method = extractAuthMethod({
        privateKey: TEST_PRIVATE_KEY
      })
      expect(method).toBe('privateKey')
    })

    it('should detect both authentication methods', () => {
      const method = extractAuthMethod({
        password: TEST_PASSWORD,
        privateKey: TEST_PRIVATE_KEY
      })
      expect(method).toBe('both')
    })

    it('should detect no authentication', () => {
      const method = extractAuthMethod({})
      expect(method).toBe('none')

      const method2 = extractAuthMethod({
        password: '',
        privateKey: ''
      })
      expect(method2).toBe('none')
    })

    it('should ignore non-string values', () => {
      const method = extractAuthMethod({
        password: 123,
        privateKey: null
      })
      expect(method).toBe('none')
    })
  })

  describe('extractOptionalTerminalSettings', () => {
    it('should extract all terminal settings', () => {
      const settings = extractOptionalTerminalSettings({
        term: TERMINAL.TYPE,
        cols: TERMINAL.TEST_COLS,
        rows: TERMINAL.TEST_ROWS
      })

      expect(settings).toEqual({
        term: TERMINAL.TYPE,
        cols: TERMINAL.TEST_COLS,
        rows: TERMINAL.TEST_ROWS
      })
    })

    it('should return empty object for no settings', () => {
      const settings = extractOptionalTerminalSettings({})
      expect(settings).toEqual({})
    })

    it('should filter out invalid terminal values', () => {
      const settings = extractOptionalTerminalSettings({
        term: '',
        cols: 0,
        rows: -1
      })
      expect(settings).toEqual({})
    })

    it('should filter out non-numeric cols/rows', () => {
      const settings = extractOptionalTerminalSettings({
        term: TERMINAL.TYPE,
        cols: 'not-a-number',
        rows: null
      })
      expect(settings).toEqual({ term: TERMINAL.TYPE })
    })

    it('should handle partial terminal settings', () => {
      const settings = extractOptionalTerminalSettings({
        cols: TERMINAL.TEST_COLS
      })
      expect(settings).toEqual({ cols: TERMINAL.TEST_COLS })
    })
  })

  describe('extractAuthCredentials', () => {
    it('should extract credentials with password', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORD
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual({
          username: TEST_USERNAME,
          host: TEST_SSH.HOST,
          port: TEST_SSH.PORT,
          password: TEST_PASSWORD
        })
      }
    })

    it('should extract credentials with privateKey and passphrase', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        privateKey: TEST_PRIVATE_KEY,
        passphrase: TEST_PASSPHRASE
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual({
          username: TEST_USERNAME,
          host: TEST_SSH.HOST,
          port: TEST_SSH.PORT,
          privateKey: TEST_PRIVATE_KEY,
          passphrase: TEST_PASSPHRASE
        })
      }
    })

    it('should extract credentials with both auth methods', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORD,
        privateKey: TEST_PRIVATE_KEY,
        passphrase: TEST_PASSPHRASE
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.password).toBe(TEST_PASSWORD)
        expect(result.value.privateKey).toBe(TEST_PRIVATE_KEY)
        expect(result.value.passphrase).toBe(TEST_PASSPHRASE)
      }
    })

    it('should include terminal settings', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORD,
        term: TERMINAL.TYPE,
        cols: TERMINAL.TEST_COLS,
        rows: TERMINAL.TEST_ROWS
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.term).toBe(TERMINAL.TYPE)
        expect(result.value.cols).toBe(TERMINAL.TEST_COLS)
        expect(result.value.rows).toBe(TERMINAL.TEST_ROWS)
      }
    })

    it('should reject missing authentication', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('password or privateKey')
      }
    })

    it('should reject missing required fields', () => {
      const result = extractAuthCredentials({
        password: TEST_PASSWORD
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(CredentialError)
      }
    })

    it('should not include passphrase without privateKey', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORD,
        passphrase: TEST_PASSPHRASE
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.passphrase).toBeUndefined()
      }
    })

    it('should handle IP addresses as host', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_IPS.PRIVATE_192,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORD
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.host).toBe(TEST_IPS.PRIVATE_192)
      }
    })

    it('should reject empty authentication values', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: '',
        privateKey: ''
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('password or privateKey')
      }
    })
  })

  describe('convertToAuthCredentials', () => {
    it('should convert valid credentials', () => {
      const creds = convertToAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORD
      })

      expect(creds).not.toBeNull()
      expect(creds?.username).toBe(TEST_USERNAME)
      expect(creds?.host).toBe(TEST_SSH.HOST)
      expect(creds?.port).toBe(TEST_SSH.PORT)
      expect(creds?.password).toBe(TEST_PASSWORD)
    })

    it('should return null for invalid credentials', () => {
      const creds = convertToAuthCredentials({
        username: TEST_USERNAME
      })

      expect(creds).toBeNull()
    })

    it('should return null for missing authentication', () => {
      const creds = convertToAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
      })

      expect(creds).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should handle undefined values', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        password: TEST_PASSWORD,
        privateKey: undefined,
        passphrase: undefined,
        term: undefined,
        cols: undefined,
        rows: undefined
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.privateKey).toBeUndefined()
        expect(result.value.passphrase).toBeUndefined()
        expect(result.value.term).toBeUndefined()
        expect(result.value.cols).toBeUndefined()
        expect(result.value.rows).toBeUndefined()
      }
    })

    it('should handle null values', () => {
      const result = extractAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        password: TEST_PASSWORD,
        privateKey: null,
        passphrase: null,
        term: null,
        cols: null,
        rows: null
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.privateKey).toBeUndefined()
        expect(result.value.passphrase).toBeUndefined()
        expect(result.value.term).toBeUndefined()
        expect(result.value.cols).toBeUndefined()
        expect(result.value.rows).toBeUndefined()
      }
    })

    it('should handle mixed valid and invalid terminal settings', () => {
      const settings = extractOptionalTerminalSettings({
        term: TERMINAL.TYPE,
        cols: 'invalid',
        rows: TERMINAL.TEST_ROWS
      })

      expect(settings).toEqual({
        term: TERMINAL.TYPE,
        rows: TERMINAL.TEST_ROWS
      })
    })

    it('should handle very large port numbers', () => {
      const result = validateRequiredFields({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: 65535
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.port).toBe(65535)
      }
    })

    it('should handle various password types from TEST_PASSWORDS', () => {
      for (const password of Object.values(TEST_PASSWORDS)) {
        const result = extractAuthCredentials({
          username: TEST_USERNAME,
          host: TEST_SSH.HOST,
          password
        })

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.password).toBe(password)
        }
      }
    })
  })
})