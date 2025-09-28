// tests/unit/validation-credentials.test.ts

import { describe, it, expect } from 'vitest'
import {
  isValidCredentials,
  validateCredentialFormat,
  type Credentials
} from '../../app/validation/credentials.js'
import { TEST_PASSWORDS, TEST_PASSPHRASE, TEST_PRIVATE_KEY, TEST_IPS } from '../test-constants.js'

describe('Credential Validation Functions', () => {
  describe('isValidCredentials', () => {
    it('should accept valid credentials with password', () => {
      const creds: Credentials = {
        username: 'user',
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.basic123
      }
      expect(isValidCredentials(creds)).toBe(true)
    })

    it('should accept valid credentials with private key', () => {
      const creds: Credentials = {
        username: 'user',
        host: TEST_IPS.PRIVATE_192,
        port: 2222,
        privateKey: '-----BEGIN RSA PRIVATE KEY-----'
      }
      expect(isValidCredentials(creds)).toBe(true)
    })

    it('should accept credentials with both password and key', () => {
      const creds: Credentials = {
        username: 'user',
        host: 'host.local',
        port: 22,
        password: TEST_PASSWORDS.basic,
        privateKey: TEST_PRIVATE_KEY,
        passphrase: TEST_PASSPHRASE
      }
      expect(isValidCredentials(creds)).toBe(true)
    })

    it('should reject missing required fields', () => {
      expect(isValidCredentials(undefined)).toBe(false)
      expect(isValidCredentials({})).toBe(false)
      expect(isValidCredentials({ username: 'user' })).toBe(false)
      expect(isValidCredentials({ host: 'host', port: 22 })).toBe(false)
      expect(isValidCredentials({
        username: 'user',
        host: 'host',
        port: 22
      })).toBe(false) // No auth method
    })

    it('should reject invalid field types', () => {
      expect(isValidCredentials({
        username: 123 as unknown as string,
        host: 'host',
        port: 22,
        password: TEST_PASSWORDS.basic
      })).toBe(false)

      expect(isValidCredentials({
        username: 'user',
        host: 'host',
        port: '22' as unknown as number,
        password: TEST_PASSWORDS.basic
      })).toBe(false)
    })
  })

  describe('validateCredentialFormat', () => {
    it('should validate correct credential format', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('should detect missing username', () => {
      const result = validateCredentialFormat({
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Username'))).toBeTruthy()
    })

    it('should detect empty username', () => {
      const result = validateCredentialFormat({
        username: '',
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Username'))).toBeTruthy()
    })

    it('should detect missing host', () => {
      const result = validateCredentialFormat({
        username: 'user',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Host'))).toBeTruthy()
    })

    it('should detect invalid port', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        port: 99999,
        password: TEST_PASSWORDS.secret
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Port'))).toBeTruthy()
    })

    it('should detect missing authentication', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        port: 22
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('password or privateKey'))).toBeTruthy()
    })

    it('should validate non-object input', () => {
      const result = validateCredentialFormat('not an object')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('must be an object'))).toBeTruthy()
    })

    it('should validate passphrase type', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        privateKey: TEST_PRIVATE_KEY,
        passphrase: 123 // Wrong type
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('Passphrase'))).toBeTruthy()
    })

    it('should allow optional passphrase', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        privateKey: 'key'
      })
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })
  })
})