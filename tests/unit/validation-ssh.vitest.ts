// tests/unit/validation-ssh.test.ts

import { describe, it, expect } from 'vitest'
import {
  validateHost,
  validatePort,
  validateTerm,
  validatePrivateKey,
  isEncryptedKey
} from '../../app/validation/ssh.js'
import { DEFAULTS } from '../../app/constants.js'
import {
  TEST_IPS,
  TEST_KEY_OPENSSH,
  TEST_KEY_RSA,
  TEST_KEY_EC,
  TEST_KEY_ENCRYPTED_RSA,
  TEST_KEY_ENCRYPTED_PKCS8,
  TEST_KEY_ENCRYPTED_OPENSSH,
  TEST_KEY_PLAIN
} from '../test-constants.js'

describe('SSH Validation Functions', () => {
  describe('validateHost', () => {
    it('should return IP addresses unchanged', () => {
      expect(validateHost(TEST_IPS.PRIVATE_192)).toBe(TEST_IPS.PRIVATE_192)
      expect(validateHost(TEST_IPS.PRIVATE_10)).toBe(TEST_IPS.PRIVATE_10)
      expect(validateHost('::1')).toBe('::1')
      expect(validateHost('2001:db8::1')).toBe('2001:db8::1')
    })

    it('should escape non-IP hostnames', () => {
      expect(validateHost('example.com')).toBe('example.com')
      expect(validateHost('host-name')).toBe('host-name')
      // HTML characters should be escaped
      expect(validateHost('host<script>')).toBe('host&lt;script&gt;')
      expect(validateHost('host&name')).toBe('host&amp;name')
    })
  })

  describe('validatePort', () => {
    it('should accept valid port numbers', () => {
      expect(validatePort(22)).toBe(22)
      expect(validatePort(8080)).toBe(8080)
      expect(validatePort(3000)).toBe(3000)
      expect(validatePort(65535)).toBe(65535)
      expect(validatePort(1)).toBe(1)
    })

    it('should return default for invalid ports', () => {
      expect(validatePort('0')).toBe(DEFAULTS.SSH_PORT)
      expect(validatePort('65536')).toBe(DEFAULTS.SSH_PORT)
      expect(validatePort('-1')).toBe(DEFAULTS.SSH_PORT)
      expect(validatePort('abc')).toBe(DEFAULTS.SSH_PORT)
      expect(validatePort(undefined)).toBe(DEFAULTS.SSH_PORT)
      expect(validatePort('')).toBe(DEFAULTS.SSH_PORT)
    })
  })

  describe('validateTerm', () => {
    it('should accept valid terminal types', () => {
      expect(validateTerm('xterm')).toBe('xterm')
      expect(validateTerm('xterm-256color')).toBe('xterm-256color')
      expect(validateTerm('vt100')).toBe('vt100')
      expect(validateTerm('screen.linux')).toBe('screen.linux')
    })

    it('should reject invalid terminal types', () => {
      expect(validateTerm('')).toBe(null)
      expect(validateTerm(undefined)).toBe(null)
      expect(validateTerm('xterm; rm -rf /')).toBe(null)
      expect(validateTerm('a'.repeat(31))).toBe(null) // Too long
      expect(validateTerm('xterm$')).toBe(null) // Invalid char
      expect(validateTerm('xterm&')).toBe(null) // Invalid char
    })
  })

  describe('validatePrivateKey', () => {
    it('should accept valid private key formats', () => {
      expect(validatePrivateKey(TEST_KEY_OPENSSH)).toBe(true)
      expect(validatePrivateKey(TEST_KEY_RSA)).toBe(true)
      expect(validatePrivateKey(TEST_KEY_EC)).toBe(true)
    })

    it('should reject invalid private keys', () => {
      expect(validatePrivateKey('')).toBe(false)
      expect(validatePrivateKey('not a key')).toBe(false)
      expect(validatePrivateKey('-----BEGIN PRIVATE KEY-----')).toBe(false)
      expect(validatePrivateKey('ssh-rsa AAAAB3...')).toBe(false) // Public key
    })
  })

  describe('isEncryptedKey', () => {
    it('should detect encrypted keys', () => {
      expect(isEncryptedKey(TEST_KEY_ENCRYPTED_RSA)).toBe(true)
      expect(isEncryptedKey(TEST_KEY_ENCRYPTED_PKCS8)).toBe(true)
      expect(isEncryptedKey(TEST_KEY_ENCRYPTED_OPENSSH)).toBe(true)
    })

    it('should detect unencrypted keys', () => {
      expect(isEncryptedKey(TEST_KEY_PLAIN)).toBe(false)
    })
  })
})