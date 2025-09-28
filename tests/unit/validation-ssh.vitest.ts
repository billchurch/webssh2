// tests/unit/validation-ssh.test.ts

import { describe, it, expect } from 'vitest'
import {
  validateHost,
  validatePort,
  validateTerm,
  validatePrivateKey,
  isEncryptedKey,
  normalizeDimension
} from '../../app/validation/ssh.js'
import { DEFAULTS } from '../../app/constants.js'
import { TEST_IPS } from '../test-constants.js'

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
      const opensshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
-----END OPENSSH PRIVATE KEY-----`
      expect(validatePrivateKey(opensshKey)).toBe(true)

      const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF0qnMDvtaE68iS8RwZTyT8TsLHYr
-----END RSA PRIVATE KEY-----`
      expect(validatePrivateKey(rsaKey)).toBe(true)

      const ecKey = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIIGLlamZU9Z83D3g8VsZqsMpLMgCuRXmZrdWpBfxHdaPoAoGCCqGSM49
-----END EC PRIVATE KEY-----`
      expect(validatePrivateKey(ecKey)).toBe(true)
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
      const encryptedRSA = `-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-128-CBC,2AF25325A9B286F4CBD8AB0C4C3CDB3A`
      expect(isEncryptedKey(encryptedRSA)).toBe(true)

      const encryptedPKCS8 = `-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFLTBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQITo1O0b8YrS0CAggA`
      expect(isEncryptedKey(encryptedPKCS8)).toBe(true)

      const encryptedOpenSSH = `-----BEGIN OPENSSH PRIVATE KEY-----
aes256-ctr
bcrypt
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABBB
-----END OPENSSH PRIVATE KEY-----`
      expect(isEncryptedKey(encryptedOpenSSH)).toBe(true)
    })

    it('should detect unencrypted keys', () => {
      const plainKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF0qnMDvtaE68iS8RwZTyT8TsLHYr`
      expect(isEncryptedKey(plainKey)).toBe(false)
    })
  })

  describe('normalizeDimension', () => {
    it('should prefer provided value when valid', () => {
      expect(normalizeDimension(100, 50, 80)).toBe(100)
      expect(normalizeDimension(100, null, 80)).toBe(100)
      expect(normalizeDimension(-5, 50, 80)).toBe(-5) // Negative values pass through
    })

    it('should use session value when provided value invalid', () => {
      expect(normalizeDimension(0, 50, 80)).toBe(50)
      expect(normalizeDimension(null, 50, 80)).toBe(50)
      expect(normalizeDimension(undefined, 50, 80)).toBe(50)
      expect(normalizeDimension('invalid', 50, 80)).toBe(50) // Invalid types use session
    })

    it('should use default when both values invalid', () => {
      expect(normalizeDimension(0, 0, 80)).toBe(80)
      expect(normalizeDimension(null, null, 80)).toBe(80)
      expect(normalizeDimension(undefined, null, 80)).toBe(80)
      expect(normalizeDimension(0, null, 80)).toBe(80)
    })

    it('should handle edge cases correctly', () => {
      expect(normalizeDimension(Number.NaN, 50, 80)).toBe(50) // NaN uses session
      expect(normalizeDimension(Infinity, 50, 80)).toBe(50) // Infinity uses session
      expect(normalizeDimension(-Infinity, 50, 80)).toBe(50) // -Infinity uses session
    })
  })
})