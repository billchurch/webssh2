// tests/envConfig.test.ts

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnvironmentConfig, getEnvironmentVariableMap, getAlgorithmPresets } from '../dist/app/envConfig.js'
import { cleanupEnvironmentVariables, storeEnvironmentVariables, restoreEnvironmentVariables } from './test-helpers.js'
import type { TestEnvironment } from './types/index.js'
import { TEST_USERNAME, TEST_PASSWORD_ALT, MY_SESSION_SECRET } from './test-constants.js'

describe('Environment Configuration Tests', () => {
  let originalEnv: TestEnvironment = {}

  beforeEach(() => {
    // Store original environment variables
    originalEnv = storeEnvironmentVariables()
    
    // Clean up all environment variables
    cleanupEnvironmentVariables()
  })

  afterEach(() => {
    // Restore original environment variables
    restoreEnvironmentVariables(originalEnv)
  })

  test('loadEnvironmentConfig returns empty object when no env vars set', () => {
    const config = loadEnvironmentConfig()
    assert.deepEqual(config, {})
  })

  test('loadEnvironmentConfig handles simple string values', () => {
    process.env.WEBSSH2_SSH_HOST = 'test.example.com'
    process.env.WEBSSH2_HEADER_TEXT = 'Test Header'

    const config = loadEnvironmentConfig()

    assert.equal(config.ssh?.host, 'test.example.com')
    assert.equal(config.header?.text, 'Test Header')
  })

  test('loadEnvironmentConfig handles numeric values', () => {
    process.env.WEBSSH2_LISTEN_PORT = '3000'
    process.env.WEBSSH2_SSH_PORT = '2222'
    process.env.WEBSSH2_SSH_READY_TIMEOUT = '30000'

    const config = loadEnvironmentConfig()

    assert.equal(config.listen?.port, 3000)
    assert.equal(config.ssh?.port, 2222)
    assert.equal(config.ssh?.readyTimeout, 30000)
  })

  test('loadEnvironmentConfig handles boolean values', () => {
    process.env.WEBSSH2_OPTIONS_CHALLENGE_BUTTON = 'true'
    process.env.WEBSSH2_OPTIONS_AUTO_LOG = 'false'
    process.env.WEBSSH2_SSH_DISABLE_INTERACTIVE_AUTH = '1'
    process.env.WEBSSH2_SSH_ALWAYS_SEND_KEYBOARD_INTERACTIVE = '0'

    const config = loadEnvironmentConfig()

    assert.equal(config.options?.challengeButton, true)
    assert.equal(config.options?.autoLog, false)
    assert.equal(config.ssh?.disableInteractiveAuth, true)
    assert.equal(config.ssh?.alwaysSendKeyboardInteractivePrompts, false)
  })

  test('loadEnvironmentConfig handles null values', () => {
    process.env.WEBSSH2_SSH_HOST = 'null'
    process.env.WEBSSH2_USER_NAME = ''
    process.env.WEBSSH2_HEADER_TEXT = 'null'

    const config = loadEnvironmentConfig()

    assert.equal(config.ssh?.host, null)
    assert.equal(config.user?.name, null)
    assert.equal(config.header?.text, null)
  })

  test('loadEnvironmentConfig handles comma-separated arrays', () => {
    process.env.WEBSSH2_HTTP_ORIGINS = 'localhost:3000,*.example.com,api.test.com'
    process.env.WEBSSH2_SSH_ALLOWED_SUBNETS = '192.168.1.0/24,10.0.0.0/8'

    const config = loadEnvironmentConfig()

    assert.deepEqual(config.http?.origins, ['localhost:3000', '*.example.com', 'api.test.com'])
    assert.deepEqual(config.ssh?.allowedSubnets, ['192.168.1.0/24', '10.0.0.0/8'])
  })

  test('loadEnvironmentConfig handles JSON array format', () => {
    process.env.WEBSSH2_SSH_ALGORITHMS_CIPHER = '["aes256-gcm@openssh.com","aes128-ctr","aes256-ctr"]'
    process.env.WEBSSH2_HTTP_ORIGINS = '["https://example.com","https://api.example.com"]'

    const config = loadEnvironmentConfig()

    assert.deepEqual(config.ssh?.algorithms?.cipher, ['aes256-gcm@openssh.com', 'aes128-ctr', 'aes256-ctr'])
    assert.deepEqual(config.http?.origins, ['https://example.com', 'https://api.example.com'])
  })

  test('loadEnvironmentConfig handles malformed JSON arrays gracefully', () => {
    process.env.WEBSSH2_HTTP_ORIGINS = '["invalid json'

    const config = loadEnvironmentConfig()

    // Should fall back to comma-separated parsing
    assert.deepEqual(config.http?.origins, ['["invalid json'])
  })

  test('loadEnvironmentConfig handles empty arrays', () => {
    process.env.WEBSSH2_HTTP_ORIGINS = ''
    process.env.WEBSSH2_SSH_ALLOWED_SUBNETS = '[]'

    const config = loadEnvironmentConfig()

    assert.deepEqual(config.http?.origins, [])
    assert.deepEqual(config.ssh?.allowedSubnets, [])
  })

  test('loadEnvironmentConfig handles SSH algorithm presets', () => {
    process.env.WEBSSH2_SSH_ALGORITHMS_PRESET = 'modern'

    const config = loadEnvironmentConfig()

    assert.ok(Array.isArray(config.ssh?.algorithms?.cipher))
    assert.ok(config.ssh?.algorithms?.cipher?.includes('aes256-gcm@openssh.com'))
    assert.ok(Array.isArray(config.ssh?.algorithms?.kex))
    assert.ok(config.ssh?.algorithms?.kex?.includes('ecdh-sha2-nistp256'))
  })

  test('loadEnvironmentConfig handles legacy algorithm preset', () => {
    process.env.WEBSSH2_SSH_ALGORITHMS_PRESET = 'legacy'

    const config = loadEnvironmentConfig()

    assert.ok(Array.isArray(config.ssh?.algorithms?.cipher))
    assert.ok(config.ssh?.algorithms?.cipher?.includes('aes256-cbc'))
    assert.ok(Array.isArray(config.ssh?.algorithms?.kex))
    assert.ok(config.ssh?.algorithms?.kex?.includes('diffie-hellman-group14-sha1'))
  })

  test('loadEnvironmentConfig handles strict algorithm preset', () => {
    process.env.WEBSSH2_SSH_ALGORITHMS_PRESET = 'strict'

    const config = loadEnvironmentConfig()

    assert.deepEqual(config.ssh?.algorithms?.cipher, ['aes256-gcm@openssh.com'])
    assert.deepEqual(config.ssh?.algorithms?.kex, ['ecdh-sha2-nistp256'])
    assert.deepEqual(config.ssh?.algorithms?.hmac, ['hmac-sha2-256'])
  })

  test('loadEnvironmentConfig handles unknown algorithm preset gracefully', () => {
    process.env.WEBSSH2_SSH_ALGORITHMS_PRESET = 'unknown'

    const config = loadEnvironmentConfig()

    // Should not set algorithms if preset is unknown
    assert.equal(config.ssh?.algorithms, undefined)
  })


  test('loadEnvironmentConfig handles all user credential fields', () => {
    process.env.WEBSSH2_USER_NAME = TEST_USERNAME
    process.env.WEBSSH2_USER_PASSWORD = TEST_PASSWORD_ALT
    process.env.WEBSSH2_USER_PRIVATE_KEY = 'base64encodedkey'
    process.env.WEBSSH2_USER_PASSPHRASE = 'keypassphrase'

    const config = loadEnvironmentConfig()

    assert.equal(config.user?.name, TEST_USERNAME)
    assert.equal(config.user?.password, TEST_PASSWORD_ALT)
    assert.equal(config.user?.privateKey, 'base64encodedkey')
    assert.equal(config.user?.passphrase, 'keypassphrase')
  })

  test('loadEnvironmentConfig handles complex nested structures', () => {
    process.env.WEBSSH2_SSH_KEEPALIVE_INTERVAL = '60'
    process.env.WEBSSH2_SSH_KEEPALIVE_COUNT_MAX = '3'

    const config = loadEnvironmentConfig()

    assert.equal(config.ssh?.keepaliveInterval, 60)
    assert.equal(config.ssh?.keepaliveCountMax, 3)
  })

  test('loadEnvironmentConfig handles header configuration', () => {
    process.env.WEBSSH2_HEADER_TEXT = 'Production Server'
    process.env.WEBSSH2_HEADER_BACKGROUND = 'red'

    const config = loadEnvironmentConfig()

    assert.equal(config.header?.text, 'Production Server')
    assert.equal(config.header?.background, 'red')
  })

  test('loadEnvironmentConfig handles all session configuration', () => {
    process.env.WEBSSH2_SESSION_SECRET = MY_SESSION_SECRET
    process.env.WEBSSH2_SESSION_NAME = 'custom.sid'

    const config = loadEnvironmentConfig()

    assert.equal(config.session?.secret, MY_SESSION_SECRET)
    assert.equal(config.session?.name, 'custom.sid')
  })

  test('loadEnvironmentConfig handles all options configuration', () => {
    process.env.WEBSSH2_OPTIONS_CHALLENGE_BUTTON = 'false'
    process.env.WEBSSH2_OPTIONS_AUTO_LOG = 'true'
    process.env.WEBSSH2_OPTIONS_ALLOW_REAUTH = 'false'
    process.env.WEBSSH2_OPTIONS_ALLOW_RECONNECT = 'false'
    process.env.WEBSSH2_OPTIONS_ALLOW_REPLAY = 'false'

    const config = loadEnvironmentConfig()

    assert.equal(config.options?.challengeButton, false)
    assert.equal(config.options?.autoLog, true)
    assert.equal(config.options?.allowReauth, false)
    assert.equal(config.options?.allowReconnect, false)
    assert.equal(config.options?.allowReplay, false)
  })



  test('loadEnvironmentConfig handles PORT variable', () => {
    process.env.PORT = '8080'

    const config = loadEnvironmentConfig()

    assert.equal(config.listen?.port, 8080)
  })

  test('loadEnvironmentConfig prioritizes WEBSSH2_LISTEN_PORT over PORT', () => {
    process.env.PORT = '8080'
    process.env.WEBSSH2_LISTEN_PORT = '3000'

    const config = loadEnvironmentConfig()

    assert.equal(config.listen?.port, 3000)
  })

  test('loadEnvironmentConfig handles all SSH algorithm types individually', () => {
    process.env.WEBSSH2_SSH_ALGORITHMS_CIPHER = 'aes256-gcm@openssh.com'
    process.env.WEBSSH2_SSH_ALGORITHMS_KEX = 'ecdh-sha2-nistp256'
    process.env.WEBSSH2_SSH_ALGORITHMS_HMAC = 'hmac-sha2-256'
    process.env.WEBSSH2_SSH_ALGORITHMS_COMPRESS = 'none'
    process.env.WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY = 'ecdsa-sha2-nistp256'

    const config = loadEnvironmentConfig()

    assert.deepEqual(config.ssh?.algorithms?.cipher, ['aes256-gcm@openssh.com'])
    assert.deepEqual(config.ssh?.algorithms?.kex, ['ecdh-sha2-nistp256'])
    assert.deepEqual(config.ssh?.algorithms?.hmac, ['hmac-sha2-256'])
    assert.deepEqual(config.ssh?.algorithms?.compress, ['none'])
    assert.deepEqual(config.ssh?.algorithms?.serverHostKey, ['ecdsa-sha2-nistp256'])
  })

  test('loadEnvironmentConfig handles whitespace in comma-separated arrays', () => {
    process.env.WEBSSH2_HTTP_ORIGINS = 'localhost:3000, *.example.com , api.test.com'

    const config = loadEnvironmentConfig()

    assert.deepEqual(config.http?.origins, ['localhost:3000', '*.example.com', 'api.test.com'])
  })

  test('loadEnvironmentConfig filters out empty array elements', () => {
    process.env.WEBSSH2_HTTP_ORIGINS = 'localhost:3000,,api.test.com,'

    const config = loadEnvironmentConfig()

    assert.deepEqual(config.http?.origins, ['localhost:3000', 'api.test.com'])
  })

  test('loadEnvironmentConfig handles complex nested configuration', () => {
    process.env.WEBSSH2_LISTEN_IP = '127.0.0.1'
    process.env.WEBSSH2_LISTEN_PORT = '3000'
    process.env.WEBSSH2_SSH_HOST = 'production.example.com'
    process.env.WEBSSH2_SSH_PORT = '2222'
    process.env.WEBSSH2_SSH_ALGORITHMS_CIPHER = 'aes256-gcm@openssh.com,aes256-ctr'
    process.env.WEBSSH2_SSH_ALGORITHMS_KEX = 'ecdh-sha2-nistp256'
    process.env.WEBSSH2_HEADER_TEXT = 'Production Environment'
    process.env.WEBSSH2_HEADER_BACKGROUND = 'red'
    process.env.WEBSSH2_OPTIONS_AUTO_LOG = 'true'
    process.env.WEBSSH2_SESSION_SECRET = 'production-secret'

    const config = loadEnvironmentConfig()

    assert.equal(config.listen?.ip, '127.0.0.1')
    assert.equal(config.listen?.port, 3000)
    assert.equal(config.ssh?.host, 'production.example.com')
    assert.equal(config.ssh?.port, 2222)
    assert.deepEqual(config.ssh?.algorithms?.cipher, ['aes256-gcm@openssh.com', 'aes256-ctr'])
    assert.deepEqual(config.ssh?.algorithms?.kex, ['ecdh-sha2-nistp256'])
    assert.equal(config.header?.text, 'Production Environment')
    assert.equal(config.header?.background, 'red')
    assert.equal(config.options?.autoLog, true)
    assert.equal(config.session?.secret, 'production-secret')
  })

  test('getEnvironmentVariableMap returns all supported variables', () => {
    const envMap = getEnvironmentVariableMap()

    assert.ok(typeof envMap === 'object')
    assert.ok('WEBSSH2_LISTEN_PORT' in envMap)
    assert.ok('WEBSSH2_SSH_HOST' in envMap)
    assert.ok('WEBSSH2_SSH_ALGORITHMS_PRESET' in envMap)
    assert.ok('PORT' in envMap)

    // Check structure of mapping
    assert.equal(envMap.WEBSSH2_LISTEN_PORT?.path, 'listen.port')
    assert.equal(envMap.WEBSSH2_LISTEN_PORT?.type, 'number')
    assert.ok(typeof envMap.WEBSSH2_LISTEN_PORT?.description === 'string')
  })

  test('getAlgorithmPresets returns all available presets', () => {
    const presets = getAlgorithmPresets()

    assert.ok(typeof presets === 'object')
    assert.ok('modern' in presets)
    assert.ok('legacy' in presets)
    assert.ok('strict' in presets)

    // Check structure of presets
    assert.ok(Array.isArray(presets.modern?.cipher))
    assert.ok(Array.isArray(presets.modern?.kex))
    assert.ok(Array.isArray(presets.modern?.hmac))
    assert.ok(Array.isArray(presets.modern?.compress))
    assert.ok(Array.isArray(presets.modern?.serverHostKey))
  })
})