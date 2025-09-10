// server
// tests/config.test.js

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import fs from 'fs'
import { resetConfigForTesting, getConfig } from '../app/config.js'
import { cleanupEnvironmentVariables, storeEnvironmentVariables, restoreEnvironmentVariables } from './test-helpers.js'

// Ensure clean state at module load
resetConfigForTesting()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Config Module - Baseline Sync Tests', () => {
  const configPath = join(__dirname, '..', 'config.json')
  const backupPath = join(__dirname, '..', 'config.json.backup')
  let originalEnv = {}

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
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, configPath)
      fs.unlinkSync(backupPath)
    } else if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
  })

  test('loads default config when config.json is missing', async () => {
    // Ensure config.json doesn't exist
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
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

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

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

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))
    process.env['PORT'] = '4444'

    // Re-import with cache bust
    const config = await getConfig()

    assert.equal(config.listen.port, 4444)
  })

  test('handles malformed JSON gracefully', async () => {
    // Write invalid JSON
    fs.writeFileSync(configPath, '{ invalid json }')

    // Re-import with cache bust
    const config = await getConfig()

    // Should fall back to defaults
    assert.equal(config.listen.ip, '0.0.0.0')
    assert.equal(config.listen.port, 2222)
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

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

    // Re-import with cache bust
    const config = await getConfig()

    // Custom algorithms should be present
    assert.ok(config.ssh.algorithms.cipher.includes('aes256-gcm@openssh.com'))
    assert.ok(config.ssh.algorithms.cipher.includes('aes256-cbc'))
    assert.ok(config.ssh.algorithms.kex.includes('ecdh-sha2-nistp256'))
    
    // Other algorithm categories should have defaults
    assert.ok(config.ssh.algorithms.hmac.length > 0)
    assert.ok(config.ssh.algorithms.serverHostKey.length > 0)
  })

  test('exports getCorsConfig function', async () => {
    const customConfig = {
      http: {
        origins: ['http://localhost:3000', 'https://example.com']
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

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
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }

    // Re-import with cache bust
    const config = await getConfig()

    assert.ok(config.session.secret)
    assert.ok(config.session.secret.length >= 32)
  })

  test('uses provided session secret from config', async () => {
    const customConfig = {
      session: {
        secret: 'test-secret-key-12345'
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

    // Re-import with cache bust
    const config = await getConfig()

    assert.equal(config.session.secret, 'test-secret-key-12345')
  })

  test('preserves default options when not overridden', async () => {
    const customConfig = {
      options: {
        challengeButton: false
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2))

    // Re-import with cache bust
    const config = await getConfig()

    assert.equal(config.options.challengeButton, false)
    assert.equal(config.options.autoLog, false)
    assert.equal(config.options.allowReauth, true)
    assert.equal(config.options.allowReconnect, true)
    assert.equal(config.options.allowReplay, true)
  })
})