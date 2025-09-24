// tests/unit/validation-ssh.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
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
      assert.equal(validateHost(TEST_IPS.PRIVATE_192), TEST_IPS.PRIVATE_192)
      assert.equal(validateHost(TEST_IPS.PRIVATE_10), TEST_IPS.PRIVATE_10)
      assert.equal(validateHost('::1'), '::1')
      assert.equal(validateHost('2001:db8::1'), '2001:db8::1')
    })

    it('should escape non-IP hostnames', () => {
      assert.equal(validateHost('example.com'), 'example.com')
      assert.equal(validateHost('host-name'), 'host-name')
      // HTML characters should be escaped
      assert.equal(validateHost('host<script>'), 'host&lt;script&gt;')
      assert.equal(validateHost('host&name'), 'host&amp;name')
    })
  })

  describe('validatePort', () => {
    it('should accept valid port numbers', () => {
      assert.equal(validatePort('22'), 22)
      assert.equal(validatePort('8080'), 8080)
      assert.equal(validatePort(3000), 3000)
      assert.equal(validatePort('65535'), 65535)
      assert.equal(validatePort('1'), 1)
    })

    it('should return default for invalid ports', () => {
      assert.equal(validatePort('0'), DEFAULTS.SSH_PORT)
      assert.equal(validatePort('65536'), DEFAULTS.SSH_PORT)
      assert.equal(validatePort('-1'), DEFAULTS.SSH_PORT)
      assert.equal(validatePort('abc'), DEFAULTS.SSH_PORT)
      assert.equal(validatePort(undefined), DEFAULTS.SSH_PORT)
      assert.equal(validatePort(''), DEFAULTS.SSH_PORT)
    })
  })

  describe('validateTerm', () => {
    it('should accept valid terminal types', () => {
      assert.equal(validateTerm('xterm'), 'xterm')
      assert.equal(validateTerm('xterm-256color'), 'xterm-256color')
      assert.equal(validateTerm('vt100'), 'vt100')
      assert.equal(validateTerm('screen.linux'), 'screen.linux')
    })

    it('should reject invalid terminal types', () => {
      assert.equal(validateTerm(''), null)
      assert.equal(validateTerm(undefined), null)
      assert.equal(validateTerm('xterm; rm -rf /'), null)
      assert.equal(validateTerm('a'.repeat(31)), null) // Too long
      assert.equal(validateTerm('xterm$'), null) // Invalid char
      assert.equal(validateTerm('xterm&'), null) // Invalid char
    })
  })

  describe('validatePrivateKey', () => {
    it('should accept valid private key formats', () => {
      const opensshKey = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
-----END OPENSSH PRIVATE KEY-----`
      assert.equal(validatePrivateKey(opensshKey), true)

      const rsaKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF0qnMDvtaE68iS8RwZTyT8TsLHYr
-----END RSA PRIVATE KEY-----`
      assert.equal(validatePrivateKey(rsaKey), true)

      const ecKey = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIIGLlamZU9Z83D3g8VsZqsMpLMgCuRXmZrdWpBfxHdaPoAoGCCqGSM49
-----END EC PRIVATE KEY-----`
      assert.equal(validatePrivateKey(ecKey), true)
    })

    it('should reject invalid private keys', () => {
      assert.equal(validatePrivateKey(''), false)
      assert.equal(validatePrivateKey('not a key'), false)
      assert.equal(validatePrivateKey('-----BEGIN PRIVATE KEY-----'), false)
      assert.equal(validatePrivateKey('ssh-rsa AAAAB3...'), false) // Public key
    })
  })

  describe('isEncryptedKey', () => {
    it('should detect encrypted keys', () => {
      const encryptedRSA = `-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-128-CBC,2AF25325A9B286F4CBD8AB0C4C3CDB3A`
      assert.equal(isEncryptedKey(encryptedRSA), true)

      const encryptedPKCS8 = `-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFLTBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQITo1O0b8YrS0CAggA`
      assert.equal(isEncryptedKey(encryptedPKCS8), true)

      const encryptedOpenSSH = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABBB`
      assert.equal(isEncryptedKey(encryptedOpenSSH), true)
    })

    it('should detect unencrypted keys', () => {
      const plainKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF0qnMDvtaE68iS8RwZTyT8TsLHYr`
      assert.equal(isEncryptedKey(plainKey), false)
    })
  })

  describe('normalizeDimension', () => {
    it('should prefer provided value when valid', () => {
      assert.equal(normalizeDimension(100, 50, 80), 100)
      assert.equal(normalizeDimension(100, null, 80), 100)
      assert.equal(normalizeDimension(-5, 50, 80), -5) // Negative values pass through
    })

    it('should use session value when provided value invalid', () => {
      assert.equal(normalizeDimension(0, 50, 80), 50)
      assert.equal(normalizeDimension(null, 50, 80), 50)
      assert.equal(normalizeDimension(undefined, 50, 80), 50)
      assert.equal(normalizeDimension('invalid', 50, 80), 80) // String values use default
    })

    it('should use default when both values invalid', () => {
      assert.equal(normalizeDimension(0, 0, 80), 80)
      assert.equal(normalizeDimension(null, null, 80), 80)
      assert.equal(normalizeDimension(undefined, null, 80), 80)
      assert.equal(normalizeDimension(0, null, 80), 80)
    })

    it('should handle edge cases correctly', () => {
      assert.equal(normalizeDimension(NaN, 50, 80), 50) // NaN uses session
      assert.equal(normalizeDimension(Infinity, 50, 80), 50) // Infinity uses session
      assert.equal(normalizeDimension(-Infinity, 50, 80), 50) // -Infinity uses session
    })
  })
})