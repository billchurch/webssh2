// tests/unit/socket/control-handler.test.ts
// Unit tests for control handler pure functions

import { describe, it } from 'node:test'
import * as assert from 'node:assert'
import {
  isReplayAllowedByConfig,
  getReplayPassword,
  validateReplayRequest,
  formatReplayData,
  shouldUseCRLF,
  type ControlSession,
} from '../../../app/socket/control-handler.js'
import type { Config } from '../../../app/types/config.js'

describe('Control Handler Pure Functions', () => {
  it('isReplayAllowedByConfig returns true when replay allowed', () => {
    const config = {
      options: {
        allowReplay: true
      }
    } as Config
    
    const result = isReplayAllowedByConfig(config)
    assert.strictEqual(result, true)
  })

  it('isReplayAllowedByConfig returns false when replay disabled', () => {
    const config = {
      options: {
        allowReplay: false
      }
    } as Config
    
    const result = isReplayAllowedByConfig(config)
    assert.strictEqual(result, false)
  })

  it('getReplayPassword extracts from session credentials', () => {
    const session: ControlSession = {
      sshCredentials: {
        host: 'example.com',
        username: 'user',
        password: 'session-password'
      }
    }
    const sessionState = { password: 'state-password' }
    
    const result = getReplayPassword(session, sessionState)
    assert.strictEqual(result, 'session-password')
  })

  it('getReplayPassword falls back to session state', () => {
    const session: ControlSession = {
      sshCredentials: {
        host: 'example.com',
        username: 'user'
      }
    }
    const sessionState = { password: 'state-password' }
    
    const result = getReplayPassword(session, sessionState)
    assert.strictEqual(result, 'state-password')
  })

  it('getReplayPassword returns null when no password available', () => {
    const session: ControlSession = {}
    const sessionState = { password: null }
    
    const result = getReplayPassword(session, sessionState)
    assert.strictEqual(result, null)
  })

  it('validateReplayRequest validates all prerequisites', () => {
    const config = {
      options: {
        allowReplay: true
      }
    } as Config
    const password = 'test-password'
    const mockShell = { write: () => {} } as any
    
    const result = validateReplayRequest(config, password, mockShell)
    assert.deepStrictEqual(result, { valid: true })
  })

  it('validateReplayRequest fails when replay disabled', () => {
    const config = {
      options: {
        allowReplay: false
      }
    } as Config
    const password = 'test-password'
    const mockShell = { write: () => {} } as any
    
    const result = validateReplayRequest(config, password, mockShell)
    assert.deepStrictEqual(result, {
      valid: false,
      error: 'Replay disabled by server configuration'
    })
  })

  it('validateReplayRequest fails when no password', () => {
    const config = {
      options: {
        allowReplay: true
      }
    } as Config
    const password = null
    const mockShell = { write: () => {} } as any
    
    const result = validateReplayRequest(config, password, mockShell)
    assert.deepStrictEqual(result, {
      valid: false,
      error: 'No password available to replay'
    })
  })

  it('validateReplayRequest fails when no shell stream', () => {
    const config = {
      options: {
        allowReplay: true
      }
    } as Config
    const password = 'test-password'
    const mockShell = null
    
    const result = validateReplayRequest(config, password, mockShell)
    assert.deepStrictEqual(result, {
      valid: false,
      error: 'No active terminal to receive replayed credentials'
    })
  })

  it('formatReplayData uses CR by default', () => {
    const result = formatReplayData('password123', false)
    assert.strictEqual(result, 'password123\\r')
  })

  it('formatReplayData uses CRLF when requested', () => {
    const result = formatReplayData('password123', true)
    assert.strictEqual(result, 'password123\\r\\n')
  })

  it('shouldUseCRLF returns config setting', () => {
    const configTrue = {
      options: {
        replayCRLF: true
      }
    } as Config
    const configFalse = {
      options: {
        replayCRLF: false
      }
    } as Config
    
    assert.strictEqual(shouldUseCRLF(configTrue), true)
    assert.strictEqual(shouldUseCRLF(configFalse), false)
  })
})