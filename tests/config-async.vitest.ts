// tests/config-async.test.ts

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import fs from 'node:fs'
import { getConfig, loadConfigAsync, resetConfigForTesting } from '../app/config.js'
import {
  logDeprecatedEnvVarWarning,
  logGeneratedSessionSecretWarning,
  logTransportConfigWarning
} from '../app/logger.js'
import { ConfigError } from '../app/errors.js'
import { setupTestEnvironment, type ConfigFileManager } from './test-utils.js'
import {
  ENV_TEST_VALUES,
  MY_SESSION_SECRET,
  TEST_SECRET_LONG,
  TEST_SESSION_SECRET,
  TEST_IPS,
  TEST_CUSTOM_PORTS
} from './test-constants.js'
import type * as LoggerModule from '../app/logger.js'

// Partial mock so the issue #535 session-secret tests (and the issue #549
// transport tests) can assert on the warn emitters; all other logger
// exports keep their real implementations.
vi.mock('../app/logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>()
  return {
    ...actual,
    logDeprecatedEnvVarWarning: vi.fn(),
    logGeneratedSessionSecretWarning: vi.fn(),
    logTransportConfigWarning: vi.fn()
  }
})

// Ensure clean state at module load
resetConfigForTesting()

const requireConfigManager = (
  env: ReturnType<typeof setupTestEnvironment>
): ConfigFileManager => {
  if (env.configManager === undefined) {
    throw new Error('Expected config manager in test environment')
  }
  return env.configManager
}

const removeConfigFile = (env: ReturnType<typeof setupTestEnvironment>): void => {
  const configManager = requireConfigManager(env)
  if (configManager.configExists()) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.unlinkSync(configManager.configPath)
  }
}

describe('Config Module - Async Tests', () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>

  beforeEach(() => {
    testEnv = setupTestEnvironment({ withConfigFile: true })

    // Reset config instance for fresh testing
    resetConfigForTesting()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  it('loadConfigAsync loads default config when config.json is missing', async () => {
    const configManager = requireConfigManager(testEnv)
    // Ensure config.json doesn't exist
    if (configManager.configExists()) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(configManager.configPath)
    }

    const config = await loadConfigAsync()

    expect(config.listen.ip).toBe('0.0.0.0')
    expect(config.listen.port).toBe(2222)
    expect(config.ssh.port).toBe(22)
    expect(config.ssh.term).toBe('xterm-256color')
    expect(config.session.name).toBe('webssh2.sid')
    expect(typeof config.session.secret === 'string' && config.session.secret !== '').toBeTruthy()
  })

  it('loads default config with null header background and passes schema validation', async () => {
    // Verifies the schema/type/default change: with no config.json and no env vars,
    // the default header.background of null is valid and does not crash startup.
    const configManager = requireConfigManager(testEnv)
    if (configManager.configExists()) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(configManager.configPath)
    }

    const config = await loadConfigAsync()

    expect(config.header.background).toBeNull()
    expect(config.header.text).toBeNull()
  })

  it('loadConfigAsync loads and merges custom config from config.json', async () => {
    const configManager = requireConfigManager(testEnv)
    const customConfig = {
      listen: {
        port: TEST_CUSTOM_PORTS.port1
      },
      ssh: {
        host: 'test.example.com'
      },
      header: {
        text: 'Test Header'
      }
    }

    configManager.writeConfig(customConfig)

    const config = await loadConfigAsync()

    // Custom values should be merged
    expect(config.listen.port).toBe(TEST_CUSTOM_PORTS.port1)
    expect(config.ssh.host).toBe('test.example.com')
    expect(config.header.text).toBe('Test Header')

    // Default values should still be present
    expect(config.listen.ip).toBe('0.0.0.0')
    expect(config.ssh.port).toBe(22)
    expect(config.ssh.term).toBe('xterm-256color')
  })

  it('loadConfigAsync overrides port with PORT environment variable', async () => {
    const configManager = requireConfigManager(testEnv)
    const customConfig = {
      listen: {
        port: TEST_CUSTOM_PORTS.port1
      }
    }

    configManager.writeConfig(customConfig)
    process.env.PORT = '4444'

    const config = await loadConfigAsync()

    expect(config.listen.port).toBe(4444)
  })

  it('loadConfigAsync throws error for malformed JSON', async () => {
    // Write invalid JSON
    const configManager = requireConfigManager(testEnv)
    const configPath = configManager.configPath
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(configPath, '{ invalid json }')

    // Should throw ConfigError for malformed JSON
    try {
      await loadConfigAsync()
      expect.fail('Should have thrown ConfigError')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError)
      expect((error as Error).message).toContain('Configuration validation failed')
    }
  })

  it('getConfig returns the same config instance on multiple calls', async () => {
    const config1 = await getConfig()
    const config2 = await getConfig()

    expect(config1).toBe(config2)
    expect(typeof config1.getCorsConfig === 'function').toBeTruthy()
  })

  it('getConfig works with custom configuration file', async () => {
    const configManager = requireConfigManager(testEnv)
    const customConfig = {
      listen: {
        port: TEST_CUSTOM_PORTS.port2
      },
      ssh: {
        algorithms: {
          cipher: ['aes256-gcm@openssh.com']
        }
      }
    }

    configManager.writeConfig(customConfig)

    const config = await getConfig()

    expect(config.listen.port).toBe(TEST_CUSTOM_PORTS.port2)
    expect(config.ssh.algorithms.cipher.includes('aes256-gcm@openssh.com') === true).toBeTruthy()
    expect(typeof config.getCorsConfig === 'function').toBeTruthy()
  })

  it('async config loading uses literal JSON values (no env var substitution)', async () => {
    const configManager = requireConfigManager(testEnv)
    // Native JSON parsing doesn't support environment variable substitution
    // This tests that literal values are preserved
    process.env.TEST_SECRET = TEST_SECRET_LONG
    
    const customConfig = {
      session: {
        secret: ENV_TEST_VALUES.secret
      }
    }

    configManager.writeConfig(customConfig)

    try {
      const config = await loadConfigAsync()
      
      // Native JSON parsing should preserve the literal string
      expect(config.session.secret).toBe(ENV_TEST_VALUES.secret)
    } finally {
      delete process.env.TEST_SECRET
    }
  })

  it('async config loading validates configuration schema', async () => {
    const configManager = requireConfigManager(testEnv)
    const validConfig = {
      listen: {
        ip: TEST_IPS.LOCALHOST,
        port: 3000
      },
      ssh: {
        port: 22,
        term: 'xterm-256color'
      }
    }

    configManager.writeConfig(validConfig)

    const config = await loadConfigAsync()

    // Should pass validation and merge successfully
    expect(config.listen.ip).toBe(TEST_IPS.LOCALHOST)
    expect(config.listen.port).toBe(3000)
    expect(config.ssh.term).toBe('xterm-256color')
  })

  it('async config preserves all SSH algorithms', async () => {
    const configManager = requireConfigManager(testEnv)
    const customConfig = {
      ssh: {
        algorithms: {
          cipher: ['aes256-gcm@openssh.com', 'aes128-ctr'],
          kex: ['ecdh-sha2-nistp256'],
          hmac: ['hmac-sha2-512']
        }
      }
    }

    configManager.writeConfig(customConfig)

    const config = await loadConfigAsync()

    expect(config.ssh.algorithms.cipher.includes('aes256-gcm@openssh.com') === true).toBeTruthy()
    expect(config.ssh.algorithms.cipher.includes('aes128-ctr') === true).toBeTruthy()
    expect(config.ssh.algorithms.kex.includes('ecdh-sha2-nistp256') === true).toBeTruthy()
    expect(config.ssh.algorithms.hmac.includes('hmac-sha2-512') === true).toBeTruthy()

    // Should still have other default algorithms
    expect(config.ssh.algorithms.serverHostKey.length > 0).toBeTruthy()
    expect(config.ssh.algorithms.compress.length > 0).toBeTruthy()
  })

  it('concurrent calls to getConfig return the same instance', async () => {
    const configManager = requireConfigManager(testEnv)
    const customConfig = {
      listen: { port: TEST_CUSTOM_PORTS.port3 }
    }

    configManager.writeConfig(customConfig)

    // Make multiple concurrent calls
    const [config1, config2, config3] = await Promise.all([
      getConfig(),
      getConfig(),
      getConfig()
    ])

    expect(config1).toBe(config2)
    expect(config2).toBe(config3)
    expect(config1.listen.port).toBe(TEST_CUSTOM_PORTS.port3)
  })

  describe('session secret (issue #535)', () => {
    const CANONICAL_ENV = 'WEBSSH2_SESSION_SECRET'
    const LEGACY_ENV = 'WEBSSH_SESSION_SECRET'
    const MIN_SECRET_LENGTH = 32
    let originalLegacy: string | undefined

    beforeEach(() => {
      // setupTestEnvironment (outer beforeEach) saves/clears WEBSSH2_* vars,
      // but the legacy WEBSSH_SESSION_SECRET name is outside that prefix —
      // save/clear it explicitly to avoid cross-test pollution.
      originalLegacy = process.env['WEBSSH_SESSION_SECRET']
      delete process.env['WEBSSH_SESSION_SECRET']
      vi.clearAllMocks()
    })

    afterEach(() => {
      if (originalLegacy === undefined) {
        delete process.env['WEBSSH_SESSION_SECRET']
      } else {
        process.env['WEBSSH_SESSION_SECRET'] = originalLegacy
      }
    })

    it('uses WEBSSH2_SESSION_SECRET for session.secret', async () => {
      removeConfigFile(testEnv)
      process.env['WEBSSH2_SESSION_SECRET'] = TEST_SESSION_SECRET

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(TEST_SESSION_SECRET)
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
    })

    it('honors legacy WEBSSH_SESSION_SECRET and emits a deprecation warning', async () => {
      removeConfigFile(testEnv)
      process.env['WEBSSH_SESSION_SECRET'] = TEST_SESSION_SECRET

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(TEST_SESSION_SECRET)
      expect(logDeprecatedEnvVarWarning).toHaveBeenCalledTimes(1)
      expect(logDeprecatedEnvVarWarning).toHaveBeenCalledWith(LEGACY_ENV, CANONICAL_ENV)
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
    })

    it('prefers WEBSSH2_SESSION_SECRET when both env vars are set', async () => {
      removeConfigFile(testEnv)
      process.env['WEBSSH2_SESSION_SECRET'] = TEST_SESSION_SECRET
      process.env['WEBSSH_SESSION_SECRET'] = MY_SESSION_SECRET

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(TEST_SESSION_SECRET)
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
    })

    it('generates a random secret and warns when no secret is configured', async () => {
      removeConfigFile(testEnv)

      const config = await loadConfigAsync()

      expect(typeof config.session.secret).toBe('string')
      expect(config.session.secret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH)
      expect(logGeneratedSessionSecretWarning).toHaveBeenCalledTimes(1)
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
    })

    it('treats an empty WEBSSH2_SESSION_SECRET as unset and warns on generation', async () => {
      removeConfigFile(testEnv)
      process.env['WEBSSH2_SESSION_SECRET'] = ''

      const config = await loadConfigAsync()

      expect(typeof config.session.secret).toBe('string')
      expect(config.session.secret.length).toBeGreaterThanOrEqual(MIN_SECRET_LENGTH)
      expect(logGeneratedSessionSecretWarning).toHaveBeenCalledTimes(1)
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
    })

    it('falls back to the legacy var when WEBSSH2_SESSION_SECRET is empty', async () => {
      removeConfigFile(testEnv)
      process.env['WEBSSH2_SESSION_SECRET'] = ''
      process.env['WEBSSH_SESSION_SECRET'] = TEST_SESSION_SECRET

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(TEST_SESSION_SECRET)
      expect(logDeprecatedEnvVarWarning).toHaveBeenCalledTimes(1)
      expect(logDeprecatedEnvVarWarning).toHaveBeenCalledWith(LEGACY_ENV, CANONICAL_ENV)
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
    })

    it('does not warn when the secret comes from config.json', async () => {
      const configManager = requireConfigManager(testEnv)
      configManager.writeConfig({ session: { secret: MY_SESSION_SECRET } })

      const config = await loadConfigAsync()

      expect(config.session.secret).toBe(MY_SESSION_SECRET)
      expect(logGeneratedSessionSecretWarning).not.toHaveBeenCalled()
      expect(logDeprecatedEnvVarWarning).not.toHaveBeenCalled()
    })
  })

  // Shares this suite's config.json fixture (createConfigFileManager hard-codes
  // a single path.join(process.cwd(), 'config.json') + backup) rather than its
  // own test file, to avoid racing another file over that fixture (issue #549).
  describe('options.transport (config.json) (issue #549)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('normalizes a string form to a single-entry array', async () => {
      const configManager = requireConfigManager(testEnv)
      configManager.writeConfig({ options: { transport: 'polling' } })

      const config = await loadConfigAsync()

      expect(config.options.transport).toEqual(['polling'])
      expect(logTransportConfigWarning).not.toHaveBeenCalled()
    })

    it('normalizes an array form, preserving order', async () => {
      const configManager = requireConfigManager(testEnv)
      configManager.writeConfig({ options: { transport: ['polling', 'websocket'] } })

      const config = await loadConfigAsync()

      expect(config.options.transport).toEqual(['polling', 'websocket'])
      expect(logTransportConfigWarning).not.toHaveBeenCalled()
    })

    it('drops an invalid value and warns with source config.json', async () => {
      const configManager = requireConfigManager(testEnv)
      configManager.writeConfig({ options: { transport: 'smtp,gopher' } })

      const config = await loadConfigAsync()

      expect(config.options.transport).toBeUndefined()
      expect(logTransportConfigWarning).toHaveBeenCalledTimes(1)
      expect(logTransportConfigWarning).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'config.json' })
      )
    })

    it('leaves options.transport undefined when absent from config.json', async () => {
      const configManager = requireConfigManager(testEnv)
      configManager.writeConfig({})

      const config = await loadConfigAsync()

      expect(config.options.transport).toBeUndefined()
      expect(logTransportConfigWarning).not.toHaveBeenCalled()
    })
  })
})
