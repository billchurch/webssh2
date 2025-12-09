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

    it('should show actual origins array', () => {
      const config: Config = {
        ...baseConfig,
        http: { origins: ['http://localhost:3000', 'https://example.com'] }
      }

      const masked = maskSensitiveConfig(config)

      expect(masked.http.origins).toEqual(['http://localhost:3000', 'https://example.com'])
    })

    it('should show actual algorithm arrays', () => {
      const masked = maskSensitiveConfig(baseConfig)

      expect(masked.ssh.algorithms.cipher).toEqual(['aes256-ctr'])
      expect(masked.ssh.algorithms.kex).toEqual(['curve25519-sha256'])
      expect(masked.ssh.algorithms.hmac).toEqual(['hmac-sha2-256'])
      expect(masked.ssh.algorithms.compress).toEqual(['none'])
      expect(masked.ssh.algorithms.serverHostKey).toEqual(['ssh-ed25519'])
    })

    it('should show all algorithm names for debugging with multiple algorithms', () => {
      const config: Config = {
        ...baseConfig,
        ssh: {
          ...baseConfig.ssh,
          algorithms: {
            cipher: ['aes256-gcm@openssh.com', 'aes128-gcm@openssh.com', 'aes256-ctr'],
            kex: ['ecdh-sha2-nistp256', 'ecdh-sha2-nistp384'],
            hmac: ['hmac-sha2-256', 'hmac-sha2-512'],
            compress: ['none', 'zlib@openssh.com'],
            serverHostKey: ['ecdsa-sha2-nistp256', 'ssh-rsa', 'ssh-ed25519']
          }
        }
      }

      const masked = maskSensitiveConfig(config)

      // Verify all algorithm names are present
      expect(masked.ssh.algorithms.cipher).toHaveLength(3)
      expect(masked.ssh.algorithms.cipher).toContain('aes256-gcm@openssh.com')
      expect(masked.ssh.algorithms.cipher).toContain('aes128-gcm@openssh.com')
      expect(masked.ssh.algorithms.cipher).toContain('aes256-ctr')

      expect(masked.ssh.algorithms.kex).toHaveLength(2)
      expect(masked.ssh.algorithms.kex).toContain('ecdh-sha2-nistp256')
      expect(masked.ssh.algorithms.kex).toContain('ecdh-sha2-nistp384')

      expect(masked.ssh.algorithms.hmac).toHaveLength(2)
      expect(masked.ssh.algorithms.hmac).toContain('hmac-sha2-256')
      expect(masked.ssh.algorithms.hmac).toContain('hmac-sha2-512')

      expect(masked.ssh.algorithms.compress).toHaveLength(2)
      expect(masked.ssh.algorithms.compress).toContain('none')
      expect(masked.ssh.algorithms.compress).toContain('zlib@openssh.com')

      expect(masked.ssh.algorithms.serverHostKey).toHaveLength(3)
      expect(masked.ssh.algorithms.serverHostKey).toContain('ecdsa-sha2-nistp256')
      expect(masked.ssh.algorithms.serverHostKey).toContain('ssh-rsa')
      expect(masked.ssh.algorithms.serverHostKey).toContain('ssh-ed25519')
    })
  })
})
