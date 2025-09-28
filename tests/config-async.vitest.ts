// tests/config-async.test.ts

import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import fs from 'node:fs'
import { getConfig, loadConfigAsync, resetConfigForTesting } from '../app/config.js'
import { ConfigError } from '../app/errors.js'
import { setupTestEnvironment } from './test-utils.js'
import { ENV_TEST_VALUES, TEST_SECRET_LONG, TEST_IPS, TEST_CUSTOM_PORTS } from './test-constants.js'

// Ensure clean state at module load
resetConfigForTesting()

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
    const configManager = testEnv.configManager!
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

  it('loadConfigAsync loads and merges custom config from config.json', async () => {
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

    testEnv.configManager!.writeConfig(customConfig)

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
    const customConfig = {
      listen: {
        port: TEST_CUSTOM_PORTS.port1
      }
    }

    testEnv.configManager!.writeConfig(customConfig)
    process.env.PORT = '4444'

    const config = await loadConfigAsync()

    expect(config.listen.port).toBe(4444)
  })

  it('loadConfigAsync throws error for malformed JSON', async () => {
    // Write invalid JSON
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(testEnv.configManager!.configPath, '{ invalid json }')

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

    testEnv.configManager!.writeConfig(customConfig)

    const config = await getConfig()

    expect(config.listen.port).toBe(TEST_CUSTOM_PORTS.port2)
    expect(config.ssh.algorithms.cipher.includes('aes256-gcm@openssh.com') === true).toBeTruthy()
    expect(typeof config.getCorsConfig === 'function').toBeTruthy()
  })

  it('async config loading uses literal JSON values (no env var substitution)', async () => {
    // Native JSON parsing doesn't support environment variable substitution
    // This tests that literal values are preserved
    process.env.TEST_SECRET = TEST_SECRET_LONG
    
    const customConfig = {
      session: {
        secret: ENV_TEST_VALUES.secret
      }
    }

    testEnv.configManager!.writeConfig(customConfig)

    try {
      const config = await loadConfigAsync()
      
      // Native JSON parsing should preserve the literal string
      expect(config.session.secret).toBe(ENV_TEST_VALUES.secret)
    } finally {
      delete process.env.TEST_SECRET
    }
  })

  it('async config loading validates configuration schema', async () => {
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

    testEnv.configManager!.writeConfig(validConfig)

    const config = await loadConfigAsync()

    // Should pass validation and merge successfully
    expect(config.listen.ip).toBe(TEST_IPS.LOCALHOST)
    expect(config.listen.port).toBe(3000)
    expect(config.ssh.term).toBe('xterm-256color')
  })

  it('async config preserves all SSH algorithms', async () => {
    const customConfig = {
      ssh: {
        algorithms: {
          cipher: ['aes256-gcm@openssh.com', 'aes128-ctr'],
          kex: ['ecdh-sha2-nistp256'],
          hmac: ['hmac-sha2-512']
        }
      }
    }

    testEnv.configManager!.writeConfig(customConfig)

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
    const customConfig = {
      listen: { port: TEST_CUSTOM_PORTS.port3 }
    }

    testEnv.configManager!.writeConfig(customConfig)

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
})