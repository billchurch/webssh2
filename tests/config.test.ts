// tests/config.test.ts

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { resetConfigForTesting, getConfig } from '../dist/app/config.js'
import { ConfigError } from '../dist/app/errors.js'
import { setupTestEnvironment, type ConfigFileManager } from './test-helpers.js'
import { TEST_SECRET_LONG } from './test-constants.js'

// Ensure clean state at module load
resetConfigForTesting()

describe('Config Module - Baseline Sync Tests', () => {
  let testEnv: ReturnType<typeof setupTestEnvironment>
  let configManager: ConfigFileManager

  beforeEach(() => {
    testEnv = setupTestEnvironment({ withConfigFile: true })
    configManager = testEnv.configManager!
    
    // Reset config instance for fresh testing
    resetConfigForTesting()
  })

  afterEach(() => {
    testEnv.cleanup()
  })

  test('loads default config when config.json is missing', async () => {
    // Ensure config.json doesn't exist
    if (configManager.configExists()) {
      fs.unlinkSync(configManager.configPath)
    }

    // Get fresh config
    const config = await getConfig()

    assert.equal(config.listen.ip, '0.0.0.0')
    assert.equal(config.listen.port, 2222)
    assert.equal(config.ssh.port, 22)
    assert.equal(config.ssh.term, 'xterm-color')
    assert.equal(config.session.name, 'webssh2.sid')
    assert.ok(config.session.secret)
  })

  test('loads and merges custom config from config.json', async () => {
    const customConfig = {
      listen: {
        port: 3333
      },
      ssh: {
        host: 'test.example.com'
      },
      header: {
        text: 'Test Header'
      }
    }

    configManager.writeConfig(customConfig)

    // Get fresh config
    const config = await getConfig()

    // Custom values should be merged
    assert.equal(config.listen.port, 3333)
    assert.equal(config.ssh.host, 'test.example.com')
    assert.equal(config.header.text, 'Test Header')
    
    // Default values should still be present
    assert.equal(config.listen.ip, '0.0.0.0')
    assert.equal(config.ssh.port, 22)
    assert.equal(config.ssh.term, 'xterm-color')
  })

  test('overrides port with PORT environment variable', async () => {
    const customConfig = {
      listen: {
        port: 3333
      }
    }

    configManager.writeConfig(customConfig)
    process.env.PORT = '4444'

    // Re-import with cache bust
    const config = await getConfig()

    assert.equal(config.listen.port, 4444)
  })

  test('throws error for malformed JSON', async () => {
    // Write invalid JSON
    fs.writeFileSync(configManager.configPath, '{ invalid json }')

    // Should throw ConfigError for malformed JSON
    await assert.rejects(
      async () => await getConfig(),
      (err: Error) => {
        assert(err instanceof ConfigError)
        assert(err.message.includes('Configuration validation failed'))
        return true
      }
    )
  })

  test('validates SSH algorithms configuration', async () => {
    const customConfig = {
      ssh: {
        algorithms: {
          cipher: ['aes256-gcm@openssh.com', 'aes256-cbc'],
          kex: ['ecdh-sha2-nistp256']
        }
      }
    }

    configManager.writeConfig(customConfig)

    // Re-import with cache bust
    const config = await getConfig()

    // Custom algorithms should be present
    assert.ok(config.ssh.algorithms?.cipher?.includes('aes256-gcm@openssh.com'))
    assert.ok(config.ssh.algorithms?.cipher?.includes('aes256-cbc'))
    assert.ok(config.ssh.algorithms?.kex?.includes('ecdh-sha2-nistp256'))
    
    // Other algorithm categories should have defaults
    assert.ok(config.ssh.algorithms?.hmac && config.ssh.algorithms.hmac.length > 0)
    assert.ok(config.ssh.algorithms?.serverHostKey && config.ssh.algorithms.serverHostKey.length > 0)
  })

  test('exports getCorsConfig function', async () => {
    const customConfig = {
      http: {
        origins: ['http://localhost:3000', 'https://example.com']
      }
    }

    configManager.writeConfig(customConfig)

    // Re-import with cache bust
    const config = await getConfig()

    assert.ok(typeof config.getCorsConfig === 'function')
    
    const corsConfig = config.getCorsConfig()
    assert.deepEqual(corsConfig.origin, ['http://localhost:3000', 'https://example.com'])
    assert.deepEqual(corsConfig.methods, ['GET', 'POST'])
    assert.equal(corsConfig.credentials, true)
  })

  test('generates secure session secret when not provided', async () => {
    // Ensure config.json doesn't exist
    if (fs.existsSync(configManager.configPath)) {
      fs.unlinkSync(configManager.configPath)
    }

    // Re-import with cache bust
    const config = await getConfig()

    assert.ok(config.session.secret)
    assert.ok(config.session.secret.length >= 32)
  })

  test('uses provided session secret from config', async () => {
    const customConfig = {
      session: {
        secret: TEST_SECRET_LONG
      }
    }

    configManager.writeConfig(customConfig)

    // Re-import with cache bust
    const config = await getConfig()

    assert.equal(config.session.secret, TEST_SECRET_LONG)
  })

  test('preserves default options when not overridden', async () => {
    const customConfig = {
      options: {
        challengeButton: false
      }
    }

    configManager.writeConfig(customConfig)

    // Re-import with cache bust
    const config = await getConfig()

    assert.equal(config.options.challengeButton, false)
    assert.equal(config.options.autoLog, false)
    assert.equal(config.options.allowReauth, true)
    assert.equal(config.options.allowReconnect, true)
    assert.equal(config.options.allowReplay, true)
  })
})