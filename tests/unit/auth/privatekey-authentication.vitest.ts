// tests/unit/auth/privatekey-authentication.vitest.ts
// Tests for private key authentication flow - Issue #441
// Tests the complete flow from config to SSH connection

import { describe, it, expect } from 'vitest'
import {
  processAuthentication,
  createSessionData,
  extractConfigCredentials,
  hasConfigCredentials
} from '../../../app/middleware/auth-processor.js'
import { convertToAuthCredentials } from '../../../app/utils/credential-extractor.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import type { Config } from '../../../app/types/config.js'
import {
  TEST_USERNAME,
  TEST_SSH_PRIVATE_KEY_VALID,
  TEST_PASSPHRASE,
  TEST_SSH,
  TEST_IPS,
  TEST_PORTS
} from '../../test-constants.js'

describe('Private Key Authentication - Issue #441', () => {
  describe('Bug #1: Session data includes host and port', () => {
    it('should include host and port in session credentials from config', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.ssh.host = TEST_SSH.HOST
      config.ssh.port = TEST_SSH.PORT

      const authResult = processAuthentication(config, null)

      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      const sessionData = createSessionData(authResult.value, config)
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>

      expect(sshCreds).toHaveProperty('username', TEST_USERNAME)
      expect(sshCreds).toHaveProperty('host', TEST_SSH.HOST)
      expect(sshCreds).toHaveProperty('port', TEST_SSH.PORT)
      expect(sshCreds).toHaveProperty('privateKey')
      expect(typeof sshCreds.privateKey).toBe('string')
    })

    it('should use config SSH host and port when creating session', () => {
      const config = createDefaultConfig()
      config.user.name = 'keyuser'
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.ssh.host = TEST_IPS.PRIVATE_192_100
      config.ssh.port = TEST_PORTS.sshServerUnit

      const authResult = processAuthentication(config, null)
      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      const sessionData = createSessionData(authResult.value, config)
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>

      expect(sshCreds.host).toBe(TEST_IPS.PRIVATE_192_100)
      expect(sshCreds.port).toBe(TEST_PORTS.sshServerUnit)
    })
  })

  describe('Bug #2: convertToAuthCredentials validates successfully', () => {
    it('should convert session credentials with privateKey to AuthCredentials', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.ssh.host = TEST_SSH.HOST
      config.ssh.port = TEST_SSH.PORT

      const authResult = processAuthentication(config, null)
      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      const sessionData = createSessionData(authResult.value, config)
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>

      // This is what BasicAuthProvider.getCredentials() does
      const credentials = convertToAuthCredentials(sshCreds)

      expect(credentials).not.toBe(null)
      expect(credentials?.username).toBe(TEST_USERNAME)
      expect(credentials?.host).toBe(TEST_SSH.HOST)
      expect(credentials?.port).toBe(TEST_SSH.PORT)
      expect(credentials?.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)
    })

    it('should fail when host is missing from session credentials', () => {
      const sessionCreds = {
        username: TEST_USERNAME,
        privateKey: TEST_SSH_PRIVATE_KEY_VALID,
        port: TEST_SSH.PORT
        // Missing host - should fail
      }

      const credentials = convertToAuthCredentials(sessionCreds)
      expect(credentials).toBe(null)
    })

    it('should default to port 22 when port is missing from session credentials', () => {
      const sessionCreds = {
        username: TEST_USERNAME,
        privateKey: TEST_SSH_PRIVATE_KEY_VALID,
        host: TEST_SSH.HOST
        // Missing port - defaults to 22
      }

      const credentials = convertToAuthCredentials(sessionCreds)
      expect(credentials).not.toBe(null)
      expect(credentials?.port).toBe(22)
    })
  })

  describe('Bug #3: Private key extraction from config', () => {
    it('should extract privateKey from config.user', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID

      const extracted = extractConfigCredentials(config)

      expect(extracted).not.toBe(null)
      expect(extracted?.username).toBe(TEST_USERNAME)
      expect(extracted?.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)
    })

    it('should extract privateKey and passphrase from config', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.user.passphrase = TEST_PASSPHRASE

      const extracted = extractConfigCredentials(config)

      expect(extracted).not.toBe(null)
      expect(extracted?.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)
      expect(extracted?.passphrase).toBe(TEST_PASSPHRASE)
    })

    it('should validate config has credentials with privateKey', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID

      const hasCredentials = hasConfigCredentials(config)
      expect(hasCredentials).toBe(true)
    })

    it('should not validate config without privateKey or password', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = null
      config.user.password = null

      const hasCredentials = hasConfigCredentials(config)
      expect(hasCredentials).toBe(false)
    })
  })

  describe('Complete authentication flow with privateKey', () => {
    it('should successfully authenticate with privateKey from config', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.ssh.host = TEST_SSH.HOST
      config.ssh.port = TEST_SSH.PORT

      // Step 1: Process authentication
      const authResult = processAuthentication(config, null)
      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      expect(authResult.value.source).toBe('config')
      expect(authResult.value.credentials.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)

      // Step 2: Create session data
      const sessionData = createSessionData(authResult.value, config)
      expect(sessionData.usedBasicAuth).toBe(true)

      // Step 3: Verify session has complete credentials
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>
      expect(sshCreds.username).toBe(TEST_USERNAME)
      expect(sshCreds.host).toBe(TEST_SSH.HOST)
      expect(sshCreds.port).toBe(TEST_SSH.PORT)
      expect(sshCreds.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)

      // Step 4: Convert credentials (simulates BasicAuthProvider)
      const credentials = convertToAuthCredentials(sshCreds)
      expect(credentials).not.toBe(null)
      expect(credentials?.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)
    })

    it('should handle privateKey with passphrase', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.user.passphrase = TEST_PASSPHRASE
      config.ssh.host = TEST_SSH.HOST
      config.ssh.port = TEST_SSH.PORT

      const authResult = processAuthentication(config, null)
      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      const sessionData = createSessionData(authResult.value, config)
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>

      expect(sshCreds.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)
      expect(sshCreds.passphrase).toBe(TEST_PASSPHRASE)

      const credentials = convertToAuthCredentials(sshCreds)
      expect(credentials?.passphrase).toBe(TEST_PASSPHRASE)
    })

    it('should include both password and privateKey when both exist', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.password = 'testpass'
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.ssh.host = TEST_SSH.HOST
      config.ssh.port = TEST_SSH.PORT

      const authResult = processAuthentication(config, null)
      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      const sessionData = createSessionData(authResult.value, config)
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>

      // Both should be present
      expect(sshCreds.password).toBe('testpass')
      expect(sshCreds.privateKey).toBe(TEST_SSH_PRIVATE_KEY_VALID)
    })
  })

  describe('Edge cases and validation', () => {
    it('should handle empty privateKey string', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = ''

      const hasCredentials = hasConfigCredentials(config)
      expect(hasCredentials).toBe(false)
    })

    it('should handle null privateKey', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = null

      const hasCredentials = hasConfigCredentials(config)
      expect(hasCredentials).toBe(false)
    })

    it('should reject credentials without authentication method', () => {
      const sessionCreds = {
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT
        // No password or privateKey
      }

      const credentials = convertToAuthCredentials(sessionCreds)
      expect(credentials).toBe(null)
    })

    it('should handle custom SSH port with privateKey', () => {
      const config = createDefaultConfig()
      config.user.name = TEST_USERNAME
      config.user.privateKey = TEST_SSH_PRIVATE_KEY_VALID
      config.ssh.host = 'custom.host'
      config.ssh.port = TEST_PORTS.sshServerUnit

      const authResult = processAuthentication(config, null)
      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      const sessionData = createSessionData(authResult.value, config)
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>

      expect(sshCreds.port).toBe(TEST_PORTS.sshServerUnit)

      const credentials = convertToAuthCredentials(sshCreds)
      expect(credentials?.port).toBe(TEST_PORTS.sshServerUnit)
    })
  })

  describe('Regression tests for Issue #441', () => {
    it('should not return null when session has complete credentials with privateKey', () => {
      // This was the original bug - convertToAuthCredentials returned null
      const sessionCreds = {
        username: 'keyuser',
        host: TEST_IPS.PRIVATE_192_2_1,
        port: TEST_SSH.PORT,
        privateKey: TEST_SSH_PRIVATE_KEY_VALID
      }

      const credentials = convertToAuthCredentials(sessionCreds)

      // Bug was: credentials === null
      // Fix: credentials should be valid
      expect(credentials).not.toBe(null)
      expect(credentials?.username).toBe('keyuser')
      expect(credentials?.privateKey).toBeTruthy()
    })

    it('should include host and port when creating session from config auth', () => {
      // This was the root cause - session data did not include host/port
      const config: Config = {
        ...createDefaultConfig(),
        user: {
          name: 'keyuser',
          password: null,
          privateKey: TEST_SSH_PRIVATE_KEY_VALID,
          passphrase: null
        },
        ssh: {
          ...createDefaultConfig().ssh,
          host: TEST_IPS.PRIVATE_192_2_1,
          port: TEST_SSH.PORT
        }
      }

      const authResult = processAuthentication(config, null)
      expect(authResult.ok).toBe(true)
      if (!authResult.ok) return

      const sessionData = createSessionData(authResult.value, config)
      const sshCreds = sessionData.sshCredentials as Record<string, unknown>

      // Bug was: host and port were missing
      // Fix: they should be present
      expect(sshCreds).toHaveProperty('host')
      expect(sshCreds).toHaveProperty('port')
      expect(sshCreds.host).toBe(TEST_IPS.PRIVATE_192_2_1)
      expect(sshCreds.port).toBe(TEST_SSH.PORT)
    })
  })
})
