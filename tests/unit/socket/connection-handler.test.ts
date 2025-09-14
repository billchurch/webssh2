// tests/unit/socket/connection-handler.test.ts
// Unit tests for connection handler pure functions

import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import {
  prepareCredentials,
  createAuthSuccessPayload,
  createAuthFailurePayload,
  createPermissionsPayload,
  buildConnectionString,
  createUIUpdatePayload,
  getConnectionErrorMessage,
} from '../../../app/socket/connection-handler.js'
import { SSHConnectionError } from '../../../app/errors.js'
import type { Config } from '../../../app/types/config.js'

describe('Connection Handler Pure Functions', () => {
  it('prepareCredentials merges server private key when none provided', () => {
    const creds = {
      host: 'example.com',
      port: 22,
      username: 'user',
      password: 'pass',
    }
    const config = {
      user: {
        privateKey: 'server-key-content'
      }
    } as Config
    
    const result = prepareCredentials(creds, config)
    
    assert.strictEqual(result.privateKey, 'server-key-content')
    assert.strictEqual(result.host, 'example.com')
    assert.strictEqual(result.username, 'user')
  })
  
  it('prepareCredentials preserves user private key when provided', () => {
    const creds = {
      host: 'example.com',
      port: 22,
      username: 'user',
      password: 'pass',
      privateKey: 'user-key-content',
    }
    const config = {
      user: {
        privateKey: 'server-key-content'
      }
    } as Config
    
    const result = prepareCredentials(creds, config)
    
    assert.strictEqual(result.privateKey, 'user-key-content')
  })

  it('createAuthSuccessPayload returns correct structure', () => {
    const result = createAuthSuccessPayload()
    
    assert.deepStrictEqual(result, {
      action: 'auth_result',
      success: true,
    })
  })

  it('createAuthFailurePayload returns correct structure', () => {
    const message = 'Authentication failed'
    const result = createAuthFailurePayload(message)
    
    assert.deepStrictEqual(result, {
      action: 'auth_result',
      success: false,
      message: 'Authentication failed',
    })
  })

  it('createPermissionsPayload extracts permissions from config', () => {
    const config = {
      options: {
        autoLog: true,
        allowReplay: false,
        allowReconnect: true,
        allowReauth: false,
      }
    } as Config
    
    const result = createPermissionsPayload(config)
    
    assert.deepStrictEqual(result, {
      autoLog: true,
      allowReplay: false,
      allowReconnect: true,
      allowReauth: false,
    })
  })

  it('buildConnectionString formats host and port', () => {
    const result = buildConnectionString('example.com', 2222)
    assert.strictEqual(result, 'ssh://example.com:2222')
  })

  it('createUIUpdatePayload creates footer update', () => {
    const connectionString = 'ssh://example.com:22'
    const result = createUIUpdatePayload(connectionString)
    
    assert.deepStrictEqual(result, {
      element: 'footer',
      value: 'ssh://example.com:22',
    })
  })

  it('getConnectionErrorMessage extracts SSH error message', () => {
    const sshError = new SSHConnectionError('Connection refused')
    const result = getConnectionErrorMessage(sshError)
    
    assert.strictEqual(result, 'Connection refused')
  })

  it('getConnectionErrorMessage returns generic message for other errors', () => {
    const genericError = new Error('Some other error')
    const result = getConnectionErrorMessage(genericError)
    
    assert.strictEqual(result, 'SSH connection failed')
  })
})