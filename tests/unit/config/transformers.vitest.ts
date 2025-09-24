// tests/unit/config/transformers.test.ts
// Unit tests for config transformation functions

import { describe, it, expect } from 'vitest'
import {
  mergeConfigs,
  applyDefaults,
  maskSensitiveConfig,
  normalizePort,
  sanitizeAlgorithmList,
  normalizeAlgorithms,
  validateCorsOrigins,
  createClientSafeConfig,
  validateSessionConfig,
  mergeMultipleConfigs
} from '../../../app/config/transformers.js'
import type { Config } from '../../../app/types/config.js'
import { DEFAULTS } from '../../../app/constants.js'
import { TEST_SESSION_SECRET_VALID, TEST_SESSION_SECRET_SHORT, TEST_SESSION_SECRET_SUPER, TEST_SSH, TEST_IPS, TEST_USERNAME, TEST_PASSWORD } from '../../test-constants.js'

describe('Config Transformers', () => {
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
      }
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
        username: 'x-username',
        password: 'x-password',
        session: 'x-session'
      }
    }
  }

  describe('mergeConfigs', () => {
    it('should merge overlay onto base config', () => {
      const overlay: Partial<Config> = {
        ssh: { port: 2222 },
        header: { text: 'Test Header' }
      }

      const result = mergeConfigs(baseConfig, overlay)
      
      expect(result.ssh.port).toBe(2222)
      expect(result.header.text).toBe('Test Header')
      expect(result.ssh.term).toBe('xterm-256color') // Preserved from base
    })

    it('should deep merge nested objects', () => {
      const overlay: Partial<Config> = {
        ssh: {
          algorithms: {
            cipher: ['aes128-ctr', 'aes256-ctr']
          }
        }
      }

      const result = mergeConfigs(baseConfig, overlay)
      
      expect(result.ssh.algorithms.cipher).toEqual(['aes128-ctr', 'aes256-ctr'])
      expect(result.ssh.algorithms.hmac).toEqual(['hmac-sha2-256']) // Preserved from base
    })

    it('should handle empty overlay', () => {
      const result = mergeConfigs(baseConfig, {})
      
      expect(result).toEqual(baseConfig)
    })
  })

  describe('applyDefaults', () => {
    it('should apply defaults to empty config', () => {
      const result = applyDefaults({})
      
      expect(result.listen.port).toBe(DEFAULTS.LISTEN_PORT)
      expect(result.ssh.port).toBe(DEFAULTS.SSH_PORT)
      expect(result.ssh.term).toBe(DEFAULTS.SSH_TERM)
      expect(result.session.name).toBe(DEFAULTS.SESSION_COOKIE_NAME)
    })

    it('should preserve provided values', () => {
      const partial: Partial<Config> = {
        listen: { ip: TEST_IPS.LOCALHOST, port: 3000 },
        ssh: { host: 'example.com', port: 2222 }
      }

      const result = applyDefaults(partial)
      
      expect(result.listen.ip).toBe(TEST_IPS.LOCALHOST)
      expect(result.listen.port).toBe(3000)
      expect(result.ssh.host).toBe('example.com')
      expect(result.ssh.port).toBe(2222)
    })

    it('should include default algorithms', () => {
      const result = applyDefaults({})
      
      expect(result.ssh.algorithms.cipher).toContain('chacha20-poly1305@openssh.com')
      expect(result.ssh.algorithms.kex).toContain('curve25519-sha256')
      expect(result.ssh.algorithms.serverHostKey).toContain('ssh-ed25519')
    })
  })

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

  describe('normalizePort', () => {
    it('should return valid port numbers as-is', () => {
      expect(normalizePort(22)).toBe(22)
      expect(normalizePort(2222)).toBe(2222)
      expect(normalizePort(65535)).toBe(65535)
    })

    it('should parse string ports', () => {
      expect(normalizePort('22')).toBe(22)
      expect(normalizePort('2222')).toBe(2222)
    })

    it('should return default for invalid ports', () => {
      expect(normalizePort(-1)).toBe(22)
      expect(normalizePort(0)).toBe(22)
      expect(normalizePort(70000)).toBe(22)
      expect(normalizePort('invalid')).toBe(22)
      expect(normalizePort(null)).toBe(22)
      expect(normalizePort(undefined)).toBe(22)
    })

    it('should use custom default', () => {
      expect(normalizePort('invalid', 2222)).toBe(2222)
      expect(normalizePort(null, 3000)).toBe(3000)
    })
  })

  describe('sanitizeAlgorithmList', () => {
    it('should remove duplicates', () => {
      const result = sanitizeAlgorithmList(['aes256-ctr', 'aes128-ctr', 'aes256-ctr'])
      
      expect(result).toEqual(['aes256-ctr', 'aes128-ctr'])
    })

    it('should remove empty strings', () => {
      const result = sanitizeAlgorithmList(['aes256-ctr', '', '  ', 'aes128-ctr'])
      
      expect(result).toEqual(['aes256-ctr', 'aes128-ctr'])
    })

    it('should handle empty array', () => {
      const result = sanitizeAlgorithmList([])
      
      expect(result).toEqual([])
    })
  })

  describe('normalizeAlgorithms', () => {
    it('should use defaults for missing algorithm types', () => {
      const result = normalizeAlgorithms({})
      
      expect(result.cipher).toContain('chacha20-poly1305@openssh.com')
      expect(result.kex).toContain('curve25519-sha256')
      expect(result.serverHostKey).toContain('ssh-ed25519')
    })

    it('should sanitize provided algorithms', () => {
      const result = normalizeAlgorithms({
        cipher: ['aes256-ctr', '', 'aes256-ctr', 'aes128-ctr']
      })
      
      expect(result.cipher).toEqual(['aes256-ctr', 'aes128-ctr'])
    })

    it('should preserve all algorithm types', () => {
      const algorithms = {
        cipher: ['aes256-ctr'],
        compress: ['none'],
        hmac: ['hmac-sha2-256'],
        kex: ['curve25519-sha256'],
        serverHostKey: ['ssh-ed25519']
      }

      const result = normalizeAlgorithms(algorithms)
      
      expect(result).toEqual(algorithms)
    })
  })

  describe('validateCorsOrigins', () => {
    it('should validate array of origins', () => {
      const result = validateCorsOrigins(['http://localhost:3000', 'https://example.com'])
      
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['http://localhost:3000', 'https://example.com'])
      }
    })

    it('should filter non-string values', () => {
      const result = validateCorsOrigins(['valid', 123, null, 'another'])
      
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['valid', 'another'])
      }
    })

    it('should trim whitespace', () => {
      const result = validateCorsOrigins(['  http://localhost  ', 'https://example.com  '])
      
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['http://localhost', 'https://example.com'])
      }
    })

    it('should return default for empty array', () => {
      const result = validateCorsOrigins([])
      
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(['*:*'])
      }
    })

    it('should reject non-array input', () => {
      const result = validateCorsOrigins('invalid')
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('must be an array')
      }
    })
  })

  describe('createClientSafeConfig', () => {
    it('should exclude sensitive fields', () => {
      const config: Config = {
        ...baseConfig,
        user: {
          name: 'testuser',
          password: 'testpass',
          privateKey: TEST_SSH.PRIVATE_KEY,
          passphrase: TEST_SSH.PASSPHRASE
        },
        session: {
          name: 'webssh2',
          secret: TEST_SESSION_SECRET_SUPER
        }
      }

      const safe = createClientSafeConfig(config)

      expect(safe.user).toBeUndefined()
      expect(safe.session).toBeUndefined()
    })

    it('should include public SSH settings', () => {
      const safe = createClientSafeConfig(baseConfig)
      
      expect(safe.ssh?.host).toBe(baseConfig.ssh.host)
      expect(safe.ssh?.port).toBe(baseConfig.ssh.port)
      expect(safe.ssh?.term).toBe(baseConfig.ssh.term)
      expect(safe.ssh?.algorithms).toEqual(baseConfig.ssh.algorithms)
    })

    it('should include header and options', () => {
      const safe = createClientSafeConfig(baseConfig)
      
      expect(safe.header).toEqual(baseConfig.header)
      expect(safe.options).toEqual(baseConfig.options)
    })
  })

  describe('validateSessionConfig', () => {
    it('should validate valid session config', () => {
      const result = validateSessionConfig({
        name: 'webssh2',
        secret: TEST_SESSION_SECRET_VALID
      })
      
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('webssh2')
        expect(result.value.secret).toBe(TEST_SESSION_SECRET_VALID)
      }
    })

    it('should reject missing name', () => {
      const result = validateSessionConfig({
        secret: TEST_SESSION_SECRET_VALID
      })
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Session name is required')
      }
    })

    it('should reject empty name', () => {
      const result = validateSessionConfig({
        name: '   ',
        secret: TEST_SESSION_SECRET_VALID
      })
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Session name is required')
      }
    })

    it('should reject missing secret', () => {
      const result = validateSessionConfig({
        name: 'webssh2'
      })
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Session secret is required')
      }
    })

    it('should reject short secret', () => {
      const result = validateSessionConfig({
        name: 'webssh2',
        secret: TEST_SESSION_SECRET_SHORT
      })
      
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('at least 32 characters')
      }
    })

    it('should trim name whitespace', () => {
      const result = validateSessionConfig({
        name: '  webssh2  ',
        secret: TEST_SESSION_SECRET_VALID
      })
      
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.name).toBe('webssh2')
      }
    })
  })

  describe('mergeMultipleConfigs', () => {
    it('should merge multiple configs in order', () => {
      const config1: Partial<Config> = {
        ssh: { port: 22 },
        header: { text: 'First' }
      }
      
      const config2: Partial<Config> = {
        ssh: { port: 2222 },
        options: { autoLog: true }
      }
      
      const config3: Partial<Config> = {
        header: { text: 'Final' }
      }

      const result = mergeMultipleConfigs(config1, config2, config3)
      
      expect(result.ssh?.port).toBe(2222) // From config2
      expect(result.header?.text).toBe('Final') // From config3
      expect(result.options?.autoLog).toBe(true) // From config2
    })

    it('should handle empty configs', () => {
      const result = mergeMultipleConfigs({}, {}, {})
      
      expect(result).toEqual({})
    })

    it('should deep merge nested objects', () => {
      const config1: Partial<Config> = {
        ssh: {
          algorithms: {
            cipher: ['aes256-ctr']
          }
        }
      }
      
      const config2: Partial<Config> = {
        ssh: {
          algorithms: {
            kex: ['curve25519-sha256']
          }
        }
      }

      const result = mergeMultipleConfigs(config1, config2)
      
      expect(result.ssh?.algorithms?.cipher).toEqual(['aes256-ctr'])
      expect(result.ssh?.algorithms?.kex).toEqual(['curve25519-sha256'])
    })
  })
})