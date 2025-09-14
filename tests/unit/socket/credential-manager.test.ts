// tests/unit/socket/credential-manager.test.ts
// Unit tests for credential manager pure functions

import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import {
  isValidCredentialFormat,
  parseDimension,
  configureTerminal,
  createCredentialErrorMessage,
  createSessionStateFromCredentials,
} from '../../../app/socket/credential-manager.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_USERNAME, TEST_PASSWORD } from '../../test-constants.js'

describe('Credential Manager Pure Functions', () => {
  it('isValidCredentialFormat accepts empty credentials', () => {
    const result = isValidCredentialFormat({})
    assert.strictEqual(result, true)
  })

  it('isValidCredentialFormat validates basic credentials', () => {
    const validCreds = {
      host: 'example.com',
      username: 'user'
    }
    const result = isValidCredentialFormat(validCreds)
    assert.strictEqual(result, true)
  })

  it('isValidCredentialFormat rejects missing host', () => {
    const invalidCreds = {
      username: 'user'
    }
    const result = isValidCredentialFormat(invalidCreds)
    assert.strictEqual(result, false)
  })

  it('isValidCredentialFormat rejects empty host', () => {
    const invalidCreds = {
      host: '',
      username: 'user'
    }
    const result = isValidCredentialFormat(invalidCreds)
    assert.strictEqual(result, false)
  })

  it('parseDimension parses valid integer strings', () => {
    assert.strictEqual(parseDimension('80'), 80)
    assert.strictEqual(parseDimension('24'), 24)
    assert.strictEqual(parseDimension(80), 80)
  })

  it('parseDimension returns null for invalid values', () => {
    assert.strictEqual(parseDimension('abc'), null)
    assert.strictEqual(parseDimension(''), null)
    assert.strictEqual(parseDimension(null), null)
    assert.strictEqual(parseDimension(undefined), null)
  })

  it('configureTerminal extracts terminal settings', () => {
    const validCreds = {
      host: 'example.com',
      username: 'user',
      term: 'xterm-256color'
    }
    const manualCreds = {
      cols: '100',
      rows: '30'
    }
    const config = {
      ssh: {
        term: 'xterm'
      }
    } as Config
    
    const result = configureTerminal(validCreds, manualCreds, config)
    
    assert.strictEqual(result.term, 'xterm-256color')
    assert.strictEqual(result.cols, 100)
    assert.strictEqual(result.rows, 30)
  })

  it('configureTerminal falls back to config term when invalid', () => {
    const validCreds = {
      host: 'example.com',
      username: 'user',
      term: null
    }
    const manualCreds = {}
    const config = {
      ssh: {
        term: 'xterm'
      }
    } as Config
    
    const result = configureTerminal(validCreds, manualCreds, config)
    
    assert.strictEqual(result.term, 'xterm')
    assert.strictEqual(result.cols, null)
    assert.strictEqual(result.rows, null)
  })

  it('createCredentialErrorMessage formats error message', () => {
    const result = createCredentialErrorMessage('Missing host')
    assert.strictEqual(result, 'Invalid credentials: Missing host')
  })

  it('createSessionStateFromCredentials extracts session state', () => {
    const credentials = {
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      host: 'example.com',
      port: 2222,
      privateKey: 'test-key',
      passphrase: 'test-passphrase'
    }
    
    const result = createSessionStateFromCredentials(credentials)
    
    assert.deepStrictEqual(result, {
      authenticated: true,
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
      privateKey: 'test-key',
      passphrase: 'test-passphrase',
      host: 'example.com',
      port: 2222,
    })
  })

  it('createSessionStateFromCredentials handles null values', () => {
    const credentials = {
      username: TEST_USERNAME
    }
    
    const result = createSessionStateFromCredentials(credentials)
    
    assert.strictEqual(result.authenticated, true)
    assert.strictEqual(result.username, TEST_USERNAME)
    assert.strictEqual(result.password, null)
    assert.strictEqual(result.privateKey, null)
    assert.strictEqual(result.passphrase, null)
    assert.strictEqual(result.host, null)
    assert.strictEqual(result.port, null)
  })
})