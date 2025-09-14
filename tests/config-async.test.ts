// tests/config-async.test.ts

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import fs from 'node:fs'
import { getConfig, loadConfigAsync, resetConfigForTesting } from '../dist/app/config.js'
import { cleanupEnvironmentVariables, storeEnvironmentVariables, restoreEnvironmentVariables } from './test-helpers.js'
import type { TestEnvironment } from './types/index.js'

// Ensure clean state at module load
resetConfigForTesting()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Config Module - Async Tests', () => {
  const configPath = join(__dirname, '..', 'config.json')
  const backupPath = join(__dirname, '..', 'config.json.backup')
  let originalEnv: TestEnvironment

  beforeEach(() => {
    // Store original environment variables
    originalEnv = storeEnvironmentVariables()
    
    // Clean up all environment variables
    cleanupEnvironmentVariables()
    
    // Backup existing config if it exists
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupPath)
    }
    
    // Reset config instance for fresh testing
    resetConfigForTesting()
  })

  afterEach(() => {
    // Restore original environment variables
    restoreEnvironmentVariables(originalEnv)
    
    // Restore original config
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, configPath)
        fs.unlinkSync(backupPath)
      } else if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath)
      }
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn('Test cleanup warning:', (error as Error).message)
    }
  })

  test('loadConfigAsync loads default config when config.json is missing', async () => {
    // Ensure config.json doesn't exist
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
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
        port: 3333
      },
      ssh: {
        host: 'test.example.com'
      },
      header: {
        text: 'Test Header'
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

    const config = await loadConfigAsync()

    // Custom values should be merged
    assert.equal(config.listen.port, 3333)
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
        port: 3333
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))
    process.env.PORT = '4444'

    const config = await loadConfigAsync()

    assert.equal(config.listen.port, 4444)
  })

  test('loadConfigAsync handles malformed JSON gracefully', async () => {
    // Write invalid JSON
    fs.writeFileSync(configPath, '{ invalid json }')

    const config = await loadConfigAsync()

    // Should fall back to defaults
    assert.equal(config.listen.ip, '0.0.0.0')
    assert.equal(config.listen.port, 2222)
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
        port: 5555
      },
      ssh: {
        algorithms: {
          cipher: ['aes256-gcm@openssh.com']
        }
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

    const config = await getConfig()

    assert.equal(config.listen.port, 5555)
    assert.ok(config.ssh.algorithms?.cipher?.includes('aes256-gcm@openssh.com'))
    assert.ok(typeof config.getCorsConfig === 'function')
  })

  test('async config loading uses literal JSON values (no env var substitution)', async () => {
    // Native JSON parsing doesn't support environment variable substitution
    // This tests that literal values are preserved
    process.env.TEST_SECRET = 'test-secret-12345'
    
    const customConfig = {
      session: {
        secret: '%TEST_SECRET%'
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

    try {
      const config = await loadConfigAsync()
      
      // Native JSON parsing should preserve the literal string
      assert.equal(config.session.secret, '%TEST_SECRET%')
    } finally {
      delete process.env.TEST_SECRET
    }
  })

  test('async config loading validates configuration schema', async () => {
    const validConfig = {
      listen: {
        ip: '127.0.0.1',
        port: 3000
      },
      ssh: {
        port: 22,
        term: 'xterm-256color'
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(validConfig, null, 2))

    const config = await loadConfigAsync()

    // Should pass validation and merge successfully
    assert.equal(config.listen.ip, '127.0.0.1')
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

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

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
      listen: { port: 6666 }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

    // Make multiple concurrent calls
    const [config1, config2, config3] = await Promise.all([
      getConfig(),
      getConfig(),
      getConfig()
    ])

    assert.strictEqual(config1, config2)
    assert.strictEqual(config2, config3)
    assert.equal(config1.listen.port, 6666)
  })
})