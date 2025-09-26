// tests/unit/validation-credentials.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isValidCredentials,
  validateCredentialFormat,
  type Credentials
} from '../../app/validation/credentials.js'
import { TEST_PASSWORDS, TEST_PASSPHRASE, TEST_PRIVATE_KEY, TEST_IPS } from '../test-constants.js'

void describe('Credential Validation Functions', () => {
  void describe('isValidCredentials', () => {
    void it('should accept valid credentials with password', () => {
      const creds: Credentials = {
        username: 'user',
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.basic123
      }
      assert.equal(isValidCredentials(creds), true)
    })

    void it('should accept valid credentials with private key', () => {
      const creds: Credentials = {
        username: 'user',
        host: TEST_IPS.PRIVATE_192,
        port: 2222,
        privateKey: '-----BEGIN RSA PRIVATE KEY-----'
      }
      assert.equal(isValidCredentials(creds), true)
    })

    void it('should accept credentials with both password and key', () => {
      const creds: Credentials = {
        username: 'user',
        host: 'host.local',
        port: 22,
        password: TEST_PASSWORDS.basic,
        privateKey: TEST_PRIVATE_KEY,
        passphrase: TEST_PASSPHRASE
      }
      assert.equal(isValidCredentials(creds), true)
    })

    void it('should reject missing required fields', () => {
      assert.equal(isValidCredentials(undefined), false)
      assert.equal(isValidCredentials({}), false)
      assert.equal(isValidCredentials({ username: 'user' }), false)
      assert.equal(isValidCredentials({ host: 'host', port: 22 }), false)
      assert.equal(isValidCredentials({ 
        username: 'user', 
        host: 'host', 
        port: 22 
      }), false) // No auth method
    })

    void it('should reject invalid field types', () => {
      assert.equal(isValidCredentials({
        username: 123 as unknown as string,
        host: 'host',
        port: 22,
        password: TEST_PASSWORDS.basic
      }), false)

      assert.equal(isValidCredentials({
        username: 'user',
        host: 'host',
        port: '22' as unknown as number,
        password: TEST_PASSWORDS.basic
      }), false)
    })
  })

  void describe('validateCredentialFormat', () => {
    void it('should validate correct credential format', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      assert.equal(result.valid, true)
      assert.equal(result.errors.length, 0)
    })

    void it('should detect missing username', () => {
      const result = validateCredentialFormat({
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some(e => e.includes('Username')))
    })

    void it('should detect empty username', () => {
      const result = validateCredentialFormat({
        username: '',
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some(e => e.includes('empty')))
    })

    void it('should detect missing host', () => {
      const result = validateCredentialFormat({
        username: 'user',
        port: 22,
        password: TEST_PASSWORDS.secret
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some(e => e.includes('Host')))
    })

    void it('should detect invalid port', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        port: 99999,
        password: TEST_PASSWORDS.secret
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some(e => e.includes('Port')))
    })

    void it('should detect missing authentication', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        port: 22
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some(e => e.includes('password or privateKey')))
    })

    void it('should validate non-object input', () => {
      const result = validateCredentialFormat('not an object')
      assert.equal(result.valid, false)
      assert.ok(result.errors.some(e => e.includes('must be an object')))
    })

    void it('should validate passphrase type', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        privateKey: TEST_PRIVATE_KEY,
        passphrase: 123 // Wrong type
      })
      assert.equal(result.valid, false)
      assert.ok(result.errors.some(e => e.includes('Passphrase')))
    })

    void it('should allow optional passphrase', () => {
      const result = validateCredentialFormat({
        username: 'user',
        host: 'example.com',
        privateKey: 'key'
      })
      assert.equal(result.valid, true)
      assert.equal(result.errors.length, 0)
    })
  })
})