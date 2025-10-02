// tests/unit/config-enhanced.test.ts
// Test enhanced config feature parity

import { describe, it, expect } from 'vitest'
import {
  validateSshHost,
  validateSshPort,
  validateCssColor,
} from '../../app/validation/config.js'
import { enhanceConfig } from '../../app/utils/index.js'
import { createDefaultConfig } from '../../app/config/config-processor.js'
import { mapEnvironmentVariables, ENV_VAR_MAPPING } from '../../app/config/env-mapper.js'
import type { Config } from '../../app/types/config.js'
import {
  TEST_USERNAME,
  TEST_PASSWORD,
  TEST_SECRET,
  TEST_SECRET_123,
  TEST_IPS,
  TEST_SUBNETS,
  SSO_AUTH_HEADERS,
  TEST_HTTP_ORIGINS
} from '../test-constants.js'

// Helper functions for environment variable tests
const createTestEnvironment = (): Record<string, string> => ({
  PORT: '3000',
  WEBSSH2_LISTEN_IP: TEST_IPS.LOCALHOST,
  WEBSSH2_LISTEN_PORT: '2222',
  WEBSSH2_HTTP_ORIGINS: TEST_HTTP_ORIGINS.MULTIPLE,
  WEBSSH2_SSH_HOST: 'example.com',
  WEBSSH2_SSH_PORT: '22',
  WEBSSH2_SSH_LOCAL_ADDRESS: TEST_IPS.PRIVATE_192,
  WEBSSH2_SSH_LOCAL_PORT: '2223',
  WEBSSH2_SSH_TERM: 'xterm-256color',
  WEBSSH2_SSH_ENV_ALLOWLIST: 'LANG,LC_ALL',
  WEBSSH2_SSH_ALLOWED_SUBNETS: `${TEST_SUBNETS.PRIVATE_192},${TEST_SUBNETS.PRIVATE_10}`,
  WEBSSH2_HEADER_TEXT: 'Test Header',
  WEBSSH2_HEADER_BACKGROUND: 'blue',
  WEBSSH2_OPTIONS_CHALLENGE_BUTTON: 'true',
  WEBSSH2_OPTIONS_AUTO_LOG: 'true',
  WEBSSH2_SSO_ENABLED: 'true',
  WEBSSH2_SSO_CSRF_PROTECTION: 'true',
  WEBSSH2_SSO_TRUSTED_PROXIES: `${TEST_IPS.LOCALHOST},${TEST_IPS.PRIVATE_192}`,
  WEBSSH2_SSO_HEADER_USERNAME: SSO_AUTH_HEADERS.username,
  WEBSSH2_SSO_HEADER_PASSWORD: SSO_AUTH_HEADERS.password,
  WEBSSH2_SSO_HEADER_SESSION: SSO_AUTH_HEADERS.session,
  WEBSSH2_LOGGING_LEVEL: 'debug',
  WEBSSH2_LOGGING_STDOUT_ENABLED: 'true',
  WEBSSH2_LOGGING_STDOUT_MIN_LEVEL: 'warn',
  WEBSSH2_LOGGING_SAMPLING_DEFAULT_RATE: '0.5',
  WEBSSH2_LOGGING_SAMPLING_RULES: '[{"target":"ssh_command","sampleRate":0.25}]',
  WEBSSH2_LOGGING_RATE_LIMIT_RULES:
    '[{"target":"ssh_command","limit":5,"intervalMs":1000,"burst":5}]',
  WEBSSH2_LOGGING_SYSLOG_ENABLED: 'true',
  WEBSSH2_LOGGING_SYSLOG_HOST: 'syslog.example.com',
  WEBSSH2_LOGGING_SYSLOG_PORT: '6514',
  WEBSSH2_LOGGING_SYSLOG_APP_NAME: 'webssh2-app',
  WEBSSH2_LOGGING_SYSLOG_ENTERPRISE_ID: '32473',
  WEBSSH2_LOGGING_SYSLOG_BUFFER_SIZE: '2000',
  WEBSSH2_LOGGING_SYSLOG_FLUSH_INTERVAL_MS: '1500',
  WEBSSH2_LOGGING_SYSLOG_INCLUDE_JSON: 'true',
  WEBSSH2_LOGGING_SYSLOG_TLS_ENABLED: 'true',
  WEBSSH2_LOGGING_SYSLOG_TLS_CA_FILE: '/etc/ssl/ca.pem',
  WEBSSH2_LOGGING_SYSLOG_TLS_CERT_FILE: '/etc/ssl/cert.pem',
  WEBSSH2_LOGGING_SYSLOG_TLS_KEY_FILE: '/etc/ssl/key.pem',
  WEBSSH2_LOGGING_SYSLOG_TLS_REJECT_UNAUTHORIZED: 'false',
})

const verifyListenConfig = (config: ReturnType<typeof mapEnvironmentVariables>): void => {
  expect(config.listen).toEqual({ ip: TEST_IPS.LOCALHOST, port: 2222 })
}

const verifySshConfig = (config: ReturnType<typeof mapEnvironmentVariables>): void => {
  expect(config.ssh).toMatchObject({
    host: 'example.com',
    port: 22,
    localAddress: TEST_IPS.PRIVATE_192,
    localPort: 2223,
    term: 'xterm-256color',
    envAllowlist: ['LANG', 'LC_ALL'],
    allowedSubnets: [TEST_SUBNETS.PRIVATE_192, TEST_SUBNETS.PRIVATE_10],
  })
}

const verifyHeaderConfig = (config: ReturnType<typeof mapEnvironmentVariables>): void => {
  expect(config.header).toEqual({
    text: 'Test Header',
    background: 'blue',
  })
}

const verifyOptionsConfig = (config: ReturnType<typeof mapEnvironmentVariables>): void => {
  expect(config.options).toMatchObject({
    challengeButton: true,
    autoLog: true,
  })
}

const verifySsoConfig = (config: ReturnType<typeof mapEnvironmentVariables>): void => {
  expect(config.sso).toMatchObject({
    enabled: true,
    csrfProtection: true,
    trustedProxies: [TEST_IPS.LOCALHOST, TEST_IPS.PRIVATE_192],
    headerMapping: {
      username: SSO_AUTH_HEADERS.username,
      password: SSO_AUTH_HEADERS.password,
      session: SSO_AUTH_HEADERS.session,
    },
  })
}

const verifyLoggingConfig = (config: ReturnType<typeof mapEnvironmentVariables>): void => {
  expect(config.logging).toMatchObject({
    minimumLevel: 'debug',
    stdout: {
      enabled: true,
      minimumLevel: 'warn'
    },
    controls: {
      sampling: {
        defaultSampleRate: 0.5,
        rules: [
          {
            target: 'ssh_command',
            sampleRate: 0.25,
          },
        ],
      },
      rateLimit: {
        rules: [
          {
            target: 'ssh_command',
            limit: 5,
            intervalMs: 1000,
            burst: 5,
          },
        ],
      },
    },
    syslog: {
      enabled: true,
      host: 'syslog.example.com',
      port: 6514,
      appName: 'webssh2-app',
      enterpriseId: 32473,
      bufferSize: 2000,
      flushIntervalMs: 1500,
      includeJson: true,
      tls: {
        enabled: true,
        caFile: '/etc/ssl/ca.pem',
        certFile: '/etc/ssl/cert.pem',
        keyFile: '/etc/ssl/key.pem',
        rejectUnauthorized: false,
      },
    },
  })
}

describe('Enhanced Config - Environment Variable Support', () => {
  it('should support all environment variables from ENV_VAR_MAPPING', () => {
    const testEnv = createTestEnvironment()
    const config = mapEnvironmentVariables(testEnv)

    // Verify all mapped values are present
    verifyListenConfig(config)
    verifySshConfig(config)
    verifyHeaderConfig(config)
    verifyOptionsConfig(config)
    verifySsoConfig(config)
    verifyLoggingConfig(config)
  })

  it('should have mapping for all core environment variables', () => {
    const envVarCount = Object.keys(ENV_VAR_MAPPING).length
    // Current implementation has 54 environment variables mapped
    expect(envVarCount).toBeGreaterThanOrEqual(54)
  })
})

describe('Enhanced Config - SSH Configuration Fields', () => {
  it('should support localAddress and localPort fields', () => {
    const config: Config = createDefaultConfig(TEST_SECRET)
    config.ssh.host = 'example.com'
    config.ssh.port = 22
    config.ssh.localAddress = TEST_IPS.PRIVATE_192
    config.ssh.localPort = 2223

    const result = enhanceConfig(config)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const enhancedConfig = result.value
      expect(enhancedConfig.ssh).toMatchObject({
        host: 'example.com',
        port: 22,
        localAddress: TEST_IPS.PRIVATE_192,
        localPort: 2223,
      })
    }
  })

  it('should support allowedSubnets field', () => {
    const config: Config = createDefaultConfig(TEST_SECRET)
    config.ssh.allowedSubnets = [TEST_SUBNETS.PRIVATE_192, TEST_SUBNETS.PRIVATE_10]

    const result = enhanceConfig(config)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const enhancedConfig = result.value
      expect(enhancedConfig.ssh.allowedSubnets).toEqual([TEST_SUBNETS.PRIVATE_192, TEST_SUBNETS.PRIVATE_10])
    }
  })

  it('should support SSH algorithms configuration', () => {
    const config: Config = createDefaultConfig(TEST_SECRET)
    config.ssh.algorithms = {
      cipher: ['aes256-gcm'],
      kex: ['curve25519-sha256'],
      hmac: ['hmac-sha2-256'],
      serverHostKey: [],
      compress: []
    }

    const result = enhanceConfig(config)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const enhancedConfig = result.value
      expect(enhancedConfig.ssh.algorithms).toMatchObject({
        cipher: ['aes256-gcm'],
        kex: ['curve25519-sha256'],
        hmac: ['hmac-sha2-256'],
      })
    }
  })
})

describe('Enhanced Config - Config Validation', () => {
  it('should validate all configuration sections', () => {
    const config: Config = createDefaultConfig(TEST_SECRET_123)

    // Update all config sections
    config.listen = { ip: TEST_IPS.LOCALHOST, port: 3000 }
    config.http = { origins: [TEST_HTTP_ORIGINS.SINGLE] }
    config.user = {
      name: TEST_USERNAME,
      password: TEST_PASSWORD,
      privateKey: null,
      passphrase: null,
    }
    config.ssh.host = 'ssh.example.com'
    config.ssh.port = 22
    config.ssh.localAddress = TEST_IPS.LOCALHOST
    config.ssh.localPort = 2223
    config.ssh.algorithms = {
      cipher: ['aes256-ctr'],
      hmac: ['hmac-sha256'],
      kex: [],
      serverHostKey: [],
      compress: []
    }
    config.ssh.allowedSubnets = [TEST_SUBNETS.PRIVATE_192]
    config.header = { text: 'Test Header', background: 'blue' }
    config.options = {
      challengeButton: true,
      autoLog: true,
      allowReauth: false,
      allowReconnect: true,
      allowReplay: false,
      replayCRLF: false,
    }
    config.session.name = 'test-session'
    config.sso = {
      enabled: true,
      csrfProtection: true,
      trustedProxies: [TEST_IPS.LOCALHOST],
      headerMapping: {
        username: SSO_AUTH_HEADERS.username,
        password: SSO_AUTH_HEADERS.password,
        sessionId: SSO_AUTH_HEADERS.session,
        host: 'x-ssh-host',
        port: 'x-ssh-port',
        algorithm: 'x-ssh-algorithm',
      },
    }

    const result = enhanceConfig(config)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const enhancedConfig = result.value
      expect(enhancedConfig.listen).toEqual({ ip: TEST_IPS.LOCALHOST, port: 3000 })
      expect(enhancedConfig.http.origins).toEqual([TEST_HTTP_ORIGINS.SINGLE])
      expect(enhancedConfig.user).toMatchObject({
        name: TEST_USERNAME,
        password: TEST_PASSWORD,
      })
      expect(enhancedConfig.ssh.host).toBe('ssh.example.com')
      expect(enhancedConfig.header).toEqual({
        text: 'Test Header',
        background: 'blue',
      })
      expect(enhancedConfig.options).toMatchObject({
        challengeButton: true,
        autoLog: true,
        allowReauth: false,
      })
      expect(enhancedConfig.session).toMatchObject({
        secret: TEST_SECRET_123,
        name: 'test-session',
      })
      expect(enhancedConfig.sso).toMatchObject({
        enabled: true,
        csrfProtection: true,
      })
    }
  })
})

describe('Enhanced Config - CORS Configuration', () => {
  it('should generate CORS config from enhanced config', async () => {
    const config: Config = createDefaultConfig(TEST_SECRET)
    config.http.origins = TEST_HTTP_ORIGINS.ARRAY

    const result = enhanceConfig(config)
    expect(result.ok).toBe(true)

    if (result.ok) {
      const enhancedConfig = result.value
      expect(enhancedConfig.http.origins).toEqual(TEST_HTTP_ORIGINS.ARRAY)

      // Import createCorsConfig from config-processor
      const { createCorsConfig } = await import('../../app/config/config-processor.js')
      const corsConfig = createCorsConfig(enhancedConfig)
      expect(corsConfig).toEqual({
        origin: TEST_HTTP_ORIGINS.ARRAY,
        methods: ['GET', 'POST'],
        credentials: true,
      })
    }
  })
})

describe('Enhanced Config - Validation Functions', () => {
  describe('validateSshHost', () => {
    it('should validate SSH hosts correctly', () => {
      expect(validateSshHost('example.com')).toBe('example.com')
      expect(validateSshHost(TEST_IPS.PRIVATE_192)).toBe(TEST_IPS.PRIVATE_192)
      expect(validateSshHost(null)).toBe(null)
      expect(validateSshHost(undefined)).toBe(null)
      expect(validateSshHost('')).toBe(null)
      expect(() => validateSshHost('invalid host')).toThrow('contains spaces')
    })
  })

  describe('validateSshPort', () => {
    it('should validate SSH ports correctly', () => {
      expect(validateSshPort(22)).toBe(22)
      expect(validateSshPort(2222)).toBe(2222)
      expect(validateSshPort(undefined)).toBe(22) // default
      expect(() => validateSshPort(0)).toThrow('Invalid SSH port')
      expect(() => validateSshPort(65536)).toThrow('Invalid SSH port')
      expect(() => validateSshPort(3.14)).toThrow('Invalid SSH port')
    })
  })

  describe('validateCssColor', () => {
    it('should validate CSS colors', () => {
      expect(validateCssColor('red')).toBe('red')
      expect(validateCssColor('#ff0000')).toBe('#ff0000')
      expect(validateCssColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)')
      expect(validateCssColor(undefined)).toBeUndefined()
      expect(validateCssColor('')).toBeUndefined()
    })
  })

})

describe('Enhanced Config - Integration with Existing Systems', () => {
  it('should use existing validation pipeline', async () => {
    // This test verifies that enhanced config integrates with the existing validation
    // Import the public API from config.ts
    const { getConfig } = await import('../../app/config.js')
    const config = await getConfig()

    // Should have all required config fields
    expect(config).toHaveProperty('listen')
    expect(config).toHaveProperty('http')
    expect(config).toHaveProperty('user')
    expect(config).toHaveProperty('ssh')
    expect(config).toHaveProperty('header')
    expect(config).toHaveProperty('options')
    expect(config).toHaveProperty('session')
    expect(config).toHaveProperty('sso')
  })
})
