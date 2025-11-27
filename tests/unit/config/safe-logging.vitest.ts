// tests/unit/config/safe-logging.test.ts
// Unit tests for safe logging functions

import { describe, it, expect } from 'vitest'
import { maskSensitiveConfig } from '../../../app/config/safe-logging.js'
import type { Config } from '../../../app/types/config.js'
import { DEFAULT_AUTH_METHODS } from '../../../app/constants/index.js'
import { createAuthMethod } from '../../../app/types/branded.js'
import { TEST_SESSION_SECRET_VALID, TEST_SSH, TEST_IPS, TEST_USERNAME, TEST_PASSWORD, SSO_HEADERS } from '../../test-constants.js'

describe('Config Safe Logging', () => {
  const baseConfig: Config = {
    listen: { ip: TEST_IPS.ANY, port: 2222 },
    http: { origins: ['*:*'] },
    user: { name: null, password: null, privateKey: null, passphrase: null },
    ssh: {
      host: null,
      port: 22,
      term: 'xterm-256color',
      readyTimeout: 20000,
      keepaliveInterval: 30000,
      keepaliveCountMax: 3,
      allowedSubnets: [],
      alwaysSendKeyboardInteractivePrompts: false,
      disableInteractiveAuth: false,
      algorithms: {
        cipher: ['aes256-ctr'],
        compress: ['none'],
        hmac: ['hmac-sha2-256'],
        kex: ['curve25519-sha256'],
        serverHostKey: ['ssh-ed25519']
      },
      allowedAuthMethods: DEFAULT_AUTH_METHODS.map(createAuthMethod)
    },
    header: { text: null, background: 'green' },
    options: {
      challengeButton: true,
      autoLog: false,
      allowReauth: true,
      allowReconnect: true,
      allowReplay: true,
      replayCRLF: false
    },
    session: { name: 'webssh2', secret: TEST_SESSION_SECRET_VALID },
    sso: {
      enabled: false,
      csrfProtection: false,
      trustedProxies: [],
      headerMapping: {
        username: SSO_HEADERS.USERNAME,
        password: SSO_HEADERS.PASSWORD,
        session: SSO_HEADERS.SESSION
      }
    }
  }

  describe('maskSensitiveConfig', () => {
    it('should mask sensitive user credentials', () => {
      const config: Config = {
        ...baseConfig,
        user: {
          name: TEST_USERNAME,
          password: TEST_PASSWORD,
          privateKey: TEST_SSH.PRIVATE_KEY,
          passphrase: TEST_SSH.PASSPHRASE
        }
      }

      const masked = maskSensitiveConfig(config)

      expect(masked.user.name).toBe('***')
      expect(masked.user.password).toBe('***')
      expect(masked.user.privateKey).toBe('***')
      expect(masked.user.passphrase).toBe('***')
    })

    it('should not mask null credentials', () => {
      const masked = maskSensitiveConfig(baseConfig)

      expect(masked.user.name).toBeNull()
      expect(masked.user.password).toBeNull()
      expect(masked.user.privateKey).toBeNull()
      expect(masked.user.passphrase).toBeNull()
    })

    it('should mask session secret', () => {
      const masked = maskSensitiveConfig(baseConfig)

      expect(masked.session.secret).toBe('***')
      expect(masked.session.name).toBe('webssh2')
    })

    it('should show count of origins instead of values', () => {
      const config: Config = {
        ...baseConfig,
        http: { origins: ['http://localhost:3000', 'https://example.com'] }
      }

      const masked = maskSensitiveConfig(config)

      expect(masked.http.origins).toBe('2 origin(s)')
    })

    it('should show algorithm counts', () => {
      const masked = maskSensitiveConfig(baseConfig)

      expect(masked.ssh.algorithms.cipher).toBe(1)
      expect(masked.ssh.algorithms.kex).toBe(1)
      expect(masked.ssh.algorithms.serverHostKey).toBe(1)
    })
  })
})
