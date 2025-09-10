// server
// tests/utils.test.js
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  deepMerge,
  getValidatedHost,
  getValidatedPort,
  isValidCredentials,
  maskSensitiveData,
  modifyHtml,
  validateConfig,
  validateSshTerm,
} from '../app/utils.js'
describe('deepMerge', () => {
  test('merges nested objects correctly', () => {
    const target = { a: { b: 1 }, c: 3 }
    const source = { a: { d: 2 }, e: 4 }
    const result = deepMerge(target, source)
    assert.deepEqual(result, { a: { b: 1, d: 2 }, c: 3, e: 4 })
  })
})
describe('getValidatedHost', () => {
  test('returns valid IP unchanged', () => {
    assert.equal(getValidatedHost('192.168.1.1'), '192.168.1.1')
  })
  test('escapes hostname with potential XSS', () => {
    assert.equal(
      getValidatedHost('host<script>alert(1)</script>'),
      'host&lt;script&gt;alert(1)&lt;&#x2F;script&gt;'
    )
  })
})
describe('getValidatedPort', () => {
  test('returns valid port number', () => {
    assert.equal(getValidatedPort('22'), 22)
  })
  test('returns default port for invalid input', () => {
    assert.equal(getValidatedPort('0'), 22)
    assert.equal(getValidatedPort('65536'), 22)
    assert.equal(getValidatedPort('invalid'), 22)
  })
})
describe('isValidCredentials', () => {
  test('validates complete credentials', () => {
    const validCreds = {
      username: 'user',
      password: 'pass',
      host: 'localhost',
      port: 22,
    }
    assert.equal(isValidCredentials(validCreds), true)
  })
  test('rejects incomplete credentials', () => {
    const invalidCreds = {
      username: 'user',
      host: 'localhost',
    }
    assert.equal(isValidCredentials(invalidCreds), false)
  })
})
describe('maskSensitiveData', () => {
  test('masks password in object', () => {
    const input = { username: 'user', password: 'secret' }
    const masked = maskSensitiveData(input)
    assert.equal(masked.password.includes('*'), true)
    assert.equal(masked.username, 'user')
  })
  test('masks nested sensitive data', () => {
    const input = {
      user: {
        credentials: {
          password: 'secret',
        },
      },
    }
    const masked = maskSensitiveData(input)
    assert.equal(masked.user.credentials.password.includes('*'), true)
  })
})
describe('modifyHtml', () => {
  test('injects config and modifies asset paths', () => {
    const html = `
      <script src="script.js"></script>
      <script>window.webssh2Config = null;</script>
    `
    const config = { key: 'value' }
    const modified = modifyHtml(html, config)
    assert.ok(modified.includes('/ssh/assets/script.js'))
    assert.ok(modified.includes('window.webssh2Config = {"key":"value"}'))
  })
})
describe('validateConfig', () => {
  test('validates correct config', () => {
    const validConfig = {
      listen: {
        ip: '0.0.0.0',
        port: 2222,
      },
      http: {
        origins: ['http://localhost:2222'],
      },
      user: {
        name: 'testuser',
        password: 'testpass',
        privateKey: null,
      },
      ssh: {
        host: 'localhost',
        port: 22,
        term: 'xterm',
        readyTimeout: 20000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 10,
        algorithms: {
          kex: ['ecdh-sha2-nistp256'],
          cipher: ['aes256-ctr'],
          hmac: ['hmac-sha2-256'],
          serverHostKey: ['ssh-rsa'],
          compress: ['none'],
        },
      },
      header: {
        text: 'WebSSH2',
        background: 'green',
      },
      options: {
        challengeButton: false,
        allowReauth: true,
        allowReplay: true,
      },
      session: {
        secret: 'mysecret',
        name: 'webssh2',
      },
    }
    assert.doesNotThrow(() => validateConfig(validConfig))
  })
  test('throws on missing required fields', () => {
    const invalidConfig = {
      listen: { ip: '0.0.0.0' }, // missing required port
      http: { origins: [] },
      user: { name: 'test' }, // missing required password
      ssh: {
        host: 'localhost',
        port: 22,
        term: 'xterm',
        // missing required fields
      },
      header: {
        text: null,
        // missing required background
      },
      options: {
        // missing required fields
      },
      // missing required session
    }
    assert.throws(() => validateConfig(invalidConfig))
  })
  test('throws on invalid field types', () => {
    const invalidTypeConfig = {
      listen: {
        ip: 123, // should be string
        port: '2222', // should be integer
      },
      http: {
        origins: 'not-an-array', // should be array
      },
      user: {
        name: true, // should be string or null
        password: 123, // should be string or null
      },
      ssh: {
        host: null,
        port: 'invalid-port', // should be integer
        term: 123, // should be string
        readyTimeout: '1000', // should be integer
        keepaliveInterval: false, // should be integer
        keepaliveCountMax: [], // should be integer
        algorithms: {
          kex: 'not-an-array', // should be array
          cipher: 'not-an-array', // should be array
          hmac: 'not-an-array', // should be array
          serverHostKey: 'not-an-array', // should be array
          compress: 'not-an-array', // should be array
        },
      },
      header: {
        text: 123, // should be string or null
        background: true, // should be string
      },
      options: {
        challengeButton: 'not-boolean', // should be boolean
        allowReauth: 1, // should be boolean
        allowReplay: 'true', // should be boolean
      },
      session: {
        secret: null, // should be string
        name: [], // should be string
      },
    }
    assert.throws(() => validateConfig(invalidTypeConfig))
  })
})
describe('validateSshTerm', () => {
  test('validates legitimate terminal types', () => {
    assert.equal(validateSshTerm('xterm'), 'xterm')
    assert.equal(validateSshTerm('xterm-256color'), 'xterm-256color')
  })
  test('returns null for invalid terminal strings', () => {
    assert.equal(validateSshTerm('<script>alert(1)</script>'), null)
    assert.equal(validateSshTerm(''), null)
  })
})
//# sourceMappingURL=utils.test.js.map
