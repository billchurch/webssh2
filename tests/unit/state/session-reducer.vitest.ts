/**
 * Tests for session reducer and sub-reducers
 */

import { describe, it, expect } from 'vitest'
import { sessionReducer } from '../../../app/state/reducers/session-reducer.js'
import { createInitialState } from '../../../app/state/types.js'
import { actions } from '../../../app/state/actions.js'
import { createSessionId, createUserId, createConnectionId } from '../../../app/types/branded.js'
import { TEST_USERNAME, TEST_PASSWORDS, TEST_SSH } from '../../test-constants.js'
import type { SessionState } from '../../../app/state/types.js'

// Reusable test helpers
const createTestState = (overrides: Partial<SessionState> = {}): SessionState => {
  const baseState = createInitialState(createSessionId('test-session'))
  return { ...baseState, ...overrides }
}

const createAuthenticatedState = (): SessionState => {
  const state = createTestState()
  return sessionReducer(
    state,
    actions.auth.success(TEST_USERNAME, 'manual', createUserId('test-user'))
  )
}

const createConnectedState = (): SessionState => {
  let state = createAuthenticatedState()
  state = sessionReducer(
    state,
    actions.connection.start(TEST_SSH.HOST, TEST_SSH.PORT)
  )
  return sessionReducer(
    state,
    actions.connection.established(createConnectionId('test-conn'))
  )
}

describe('sessionReducer', () => {
  describe('initial state', () => {
    it('should create initial state with correct defaults', () => {
      const sessionId = createSessionId('test-123')
      const state = createInitialState(sessionId)
      
      expect(state.id).toBe(sessionId)
      expect(state.auth.status).toBe('pending')
      expect(state.connection.status).toBe('disconnected')
      expect(state.terminal.rows).toBe(TEST_SSH.TERMINAL.DEFAULT_ROWS)
      expect(state.terminal.cols).toBe(TEST_SSH.TERMINAL.DEFAULT_COLS)
    })
  })

  describe('session-level actions', () => {
    it('should reset session on SESSION_RESET', () => {
      const state = createConnectedState()
      const newState = sessionReducer(state, actions.session.reset())
      
      expect(newState.auth.status).toBe('pending')
      expect(newState.connection.status).toBe('disconnected')
      expect(newState.id).toBe(state.id) // ID should remain the same
    })

    it('should end session on SESSION_END', () => {
      const state = createConnectedState()
      const newState = sessionReducer(state, actions.session.end())
      
      expect(newState.connection.status).toBe('closed')
      expect(newState.connection.connectionId).toBeNull()
      expect(newState.auth.status).toBe('pending')
    })
  })
})

describe('authReducer via sessionReducer', () => {
  it('should handle AUTH_REQUEST', () => {
    const state = createTestState()
    const newState = sessionReducer(
      state,
      actions.auth.request('manual', TEST_USERNAME)
    )
    
    expect(newState.auth.status).toBe('pending')
    expect(newState.auth.method).toBe('manual')
    expect(newState.auth.username).toBe(TEST_USERNAME)
    expect(newState.auth.errorMessage).toBeNull()
  })

  it('should handle AUTH_SUCCESS', () => {
    const state = createTestState()
    const userId = createUserId('user-123')
    const newState = sessionReducer(
      state,
      actions.auth.success(TEST_USERNAME, 'basic', userId)
    )
    
    expect(newState.auth.status).toBe('authenticated')
    expect(newState.auth.username).toBe(TEST_USERNAME)
    expect(newState.auth.method).toBe('basic')
    expect(newState.auth.errorMessage).toBeNull()
    expect(newState.metadata.userId).toBe(userId)
  })

  it('should handle AUTH_FAILURE', () => {
    const state = createTestState()
    const errorMsg = 'Invalid credentials'
    const newState = sessionReducer(
      state,
      actions.auth.failure(errorMsg, 'manual')
    )
    
    expect(newState.auth.status).toBe('failed')
    expect(newState.auth.errorMessage).toBe(errorMsg)
    expect(newState.auth.method).toBe('manual')
  })

  it('should handle AUTH_LOGOUT', () => {
    const state = createAuthenticatedState()
    const newState = sessionReducer(state, actions.auth.logout())
    
    expect(newState.auth.status).toBe('pending')
    expect(newState.auth.username).toBeNull()
    expect(newState.auth.method).toBeNull()
  })

  it('should clear error on AUTH_CLEAR_ERROR', () => {
    const state = createTestState()
    const stateWithError = sessionReducer(
      state,
      actions.auth.failure('Some error', 'manual')
    )
    const newState = sessionReducer(stateWithError, actions.auth.clearError())
    
    expect(newState.auth.errorMessage).toBeNull()
    expect(newState.auth.status).toBe('failed') // Status should not change
  })
})

describe('connectionReducer via sessionReducer', () => {
  it('should handle CONNECTION_START', () => {
    const state = createAuthenticatedState()
    const newState = sessionReducer(
      state,
      actions.connection.start(TEST_SSH.HOST, TEST_SSH.PORT)
    )
    
    expect(newState.connection.status).toBe('connecting')
    expect(newState.connection.host).toBe(TEST_SSH.HOST)
    expect(newState.connection.port).toBe(TEST_SSH.PORT)
    expect(newState.connection.errorMessage).toBeNull()
  })

  it('should handle CONNECTION_ESTABLISHED', () => {
    const state = createAuthenticatedState()
    const connectionId = createConnectionId('conn-123')
    const connecting = sessionReducer(
      state,
      actions.connection.start(TEST_SSH.HOST, TEST_SSH.PORT)
    )
    const newState = sessionReducer(
      connecting,
      actions.connection.established(connectionId)
    )
    
    expect(newState.connection.status).toBe('connected')
    expect(newState.connection.connectionId).toBe(connectionId)
    expect(newState.connection.errorMessage).toBeNull()
  })

  it('should handle CONNECTION_ERROR', () => {
    const state = createTestState()
    const errorMsg = 'Connection refused'
    const newState = sessionReducer(
      state,
      actions.connection.error(errorMsg)
    )
    
    expect(newState.connection.status).toBe('error')
    expect(newState.connection.errorMessage).toBe(errorMsg)
  })

  it('should handle CONNECTION_CLOSED', () => {
    const state = createConnectedState()
    const reason = 'User initiated disconnect'
    const newState = sessionReducer(
      state,
      actions.connection.closed(reason)
    )
    
    expect(newState.connection.status).toBe('closed')
    expect(newState.connection.connectionId).toBeNull()
    expect(newState.connection.errorMessage).toBe(reason)
  })

  it('should update lastActivity on CONNECTION_ACTIVITY', () => {
    const state = createConnectedState()
    const before = state.connection.lastActivity
    
    // Wait a bit to ensure timestamp changes
    const newState = sessionReducer(state, actions.connection.activity())
    
    expect(newState.connection.lastActivity).toBeGreaterThanOrEqual(before)
  })
})

describe('terminalReducer via sessionReducer', () => {
  it('should handle TERMINAL_RESIZE', () => {
    const state = createTestState()
    const newState = sessionReducer(
      state,
      actions.terminal.resize(TEST_SSH.TERMINAL.LARGE_ROWS, TEST_SSH.TERMINAL.LARGE_COLS)
    )
    
    expect(newState.terminal.rows).toBe(TEST_SSH.TERMINAL.LARGE_ROWS)
    expect(newState.terminal.cols).toBe(TEST_SSH.TERMINAL.LARGE_COLS)
  })

  it('should handle TERMINAL_SET_TERM', () => {
    const state = createTestState()
    const termType = 'vt100'
    const newState = sessionReducer(
      state,
      actions.terminal.setTerm(termType)
    )
    
    expect(newState.terminal.term).toBe(termType)
  })

  it('should handle TERMINAL_SET_ENV', () => {
    const state = createTestState()
    const env = { 
      PATH: TEST_SSH.ENV_VARS.PATH,
      USER: TEST_SSH.ENV_VARS.USER,
      LANG: 'en_US.UTF-8'
    }
    const newState = sessionReducer(
      state,
      actions.terminal.setEnv(env)
    )
    
    expect(newState.terminal.environment).toEqual(env)
  })

  it('should handle TERMINAL_SET_CWD', () => {
    const state = createTestState()
    const cwd = '/home/user'
    const newState = sessionReducer(
      state,
      actions.terminal.setCwd(cwd)
    )
    
    expect(newState.terminal.cwd).toBe(cwd)
  })
})

describe('metadataReducer via sessionReducer', () => {
  it('should handle METADATA_SET_CLIENT', () => {
    const state = createTestState()
    const clientIp = TEST_SSH.IP_ADDRESS
    const userAgent = 'Mozilla/5.0'
    const newState = sessionReducer(
      state,
      actions.metadata.setClient(clientIp, userAgent)
    )

    expect(newState.metadata.clientIp).toBe(clientIp)
    expect(newState.metadata.userAgent).toBe(userAgent)
  })

  it('should update timestamp on various actions', () => {
    const state = createTestState()
    const initialTimestamp = state.metadata.updatedAt
    
    // Test that terminal resize updates timestamp
    const resizedState = sessionReducer(
      state,
      actions.terminal.resize(30, 100)
    )
    expect(resizedState.metadata.updatedAt).toBeGreaterThanOrEqual(initialTimestamp)
    
    // Test that connection activity updates timestamp
    const activeState = sessionReducer(
      resizedState,
      actions.connection.activity()
    )
    expect(activeState.metadata.updatedAt).toBeGreaterThanOrEqual(resizedState.metadata.updatedAt)
  })
})

describe('state immutability', () => {
  it('should not mutate the original state', () => {
    const originalState = createTestState()
    const stateCopy = JSON.parse(JSON.stringify(originalState))
    
    sessionReducer(originalState, actions.auth.success(TEST_USERNAME, 'manual'))
    
    expect(originalState).toEqual(stateCopy)
  })

  it('should return the same state reference if no changes', () => {
    const state = createTestState()
    const newState = sessionReducer(state, { type: 'UNKNOWN_ACTION' } as any)
    
    // For unknown actions, sub-reducers should return same references
    expect(newState.auth).toBe(state.auth)
    expect(newState.connection).toBe(state.connection)
    expect(newState.terminal).toBe(state.terminal)
    expect(newState.metadata).toBe(state.metadata)
  })
})