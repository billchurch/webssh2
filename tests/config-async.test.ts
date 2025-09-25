// tests/config-async.test.ts

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getConfig, loadConfigAsync, resetConfigForTesting } from '../dist/app/config.js'
import { ConfigError } from '../dist/app/errors.js'
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

  test('loadConfigAsync loads default config when config.json is missing', async () => {
    const configManager = testEnv.configManager!
    // Ensure config.json doesn't exist
    if (configManager.configExists()) {
      fs.unlinkSync(configManager.configPath)
    }

    const config = await loadConfigAsync()

    assert.equal(config.listen.ip, '0.0.0.0')
    assert.equal(config.listen.port, 2222)
    assert.equal(config.ssh.port, 22)
    assert.equal(config.ssh.term, 'xterm-color')
    assert.equal(config.session.name, 'webssh2.sid')
    assert.ok(config.session.secret)
  })

  test('loadConfigAsync loads and merges custom config from config.json', async () => {
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
    assert.equal(config.listen.port, TEST_CUSTOM_PORTS.port1)
    assert.equal(config.ssh.host, 'test.example.com')
    assert.equal(config.header.text, 'Test Header')
    
    // Default values should still be present
    assert.equal(config.listen.ip, '0.0.0.0')
    assert.equal(config.ssh.port, 22)
    assert.equal(config.ssh.term, 'xterm-color')
  })

  test('loadConfigAsync overrides port with PORT environment variable', async () => {
    const customConfig = {
      listen: {
        port: TEST_CUSTOM_PORTS.port1
      }
    }

    testEnv.configManager!.writeConfig(customConfig)
    process.env.PORT = '4444'

    const config = await loadConfigAsync()

    assert.equal(config.listen.port, 4444)
  })

  test('loadConfigAsync throws error for malformed JSON', async () => {
    // Write invalid JSON
    fs.writeFileSync(testEnv.configManager!.configPath, '{ invalid json }')

    // Should throw ConfigError for malformed JSON
    await assert.rejects(
      async () => await loadConfigAsync(),
      (err: Error) => {
        assert(err instanceof ConfigError)
        assert(err.message.includes('Configuration validation failed'))
        return true
      }
    )
  })

  test('getConfig returns the same config instance on multiple calls', async () => {
    const config1 = await getConfig()
    const config2 = await getConfig()

    assert.strictEqual(config1, config2)
    assert.ok(typeof config1.getCorsConfig === 'function')
  })

  test('getConfig works with custom configuration file', async () => {
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

    assert.equal(config.listen.port, TEST_CUSTOM_PORTS.port2)
    assert.ok(config.ssh.algorithms?.cipher?.includes('aes256-gcm@openssh.com'))
    assert.ok(typeof config.getCorsConfig === 'function')
  })

  test('async config loading uses literal JSON values (no env var substitution)', async () => {
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
      assert.equal(config.session.secret, ENV_TEST_VALUES.secret)
    } finally {
      delete process.env.TEST_SECRET
    }
  })

  test('async config loading validates configuration schema', async () => {
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
    assert.equal(config.listen.ip, TEST_IPS.LOCALHOST)
    assert.equal(config.listen.port, 3000)
    assert.equal(config.ssh.term, 'xterm-256color')
  })

  test('async config preserves all SSH algorithms', async () => {
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

    assert.ok(config.ssh.algorithms?.cipher?.includes('aes256-gcm@openssh.com'))
    assert.ok(config.ssh.algorithms?.cipher?.includes('aes128-ctr'))
    assert.ok(config.ssh.algorithms?.kex?.includes('ecdh-sha2-nistp256'))
    assert.ok(config.ssh.algorithms?.hmac?.includes('hmac-sha2-512'))
    
    // Should still have other default algorithms
    assert.ok(config.ssh.algorithms?.serverHostKey && config.ssh.algorithms.serverHostKey.length > 0)
    assert.ok(config.ssh.algorithms?.compress && config.ssh.algorithms.compress.length > 0)
  })

  test('concurrent calls to getConfig return the same instance', async () => {
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

    assert.strictEqual(config1, config2)
    assert.strictEqual(config2, config3)
    assert.equal(config1.listen.port, TEST_CUSTOM_PORTS.port3)
  })
})