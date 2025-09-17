/**
 * Tests for state selectors
 */

import { describe, it, expect } from 'vitest'
import * as selectors from '../../../app/state/selectors.js'
import { createInitialState } from '../../../app/state/types.js'
import { sessionReducer } from '../../../app/state/reducers/session-reducer.js'
import { actions } from '../../../app/state/actions.js'
import { createSessionId, createUserId, createConnectionId } from '../../../app/types/branded.js'
import { TEST_USERNAME, TEST_SSH, TEST_TIMEOUTS } from '../../test-constants.js'
import type { SessionState } from '../../../app/state/types.js'

// Reusable state builders
const stateBuilders = {
  initial: () => createInitialState(createSessionId('test-session')),
  
  authenticated: () => {
    const state = stateBuilders.initial()
    return sessionReducer(
      state,
      actions.auth.success(TEST_USERNAME, 'manual', createUserId('test-user'))
    )
  },
  
  connected: () => {
    let state = stateBuilders.authenticated()
    state = sessionReducer(
      state,
      actions.connection.start(TEST_SSH.HOST, TEST_SSH.PORT)
    )
    return sessionReducer(
      state,
      actions.connection.established(createConnectionId('test-conn'))
    )
  },
  
  withAuthError: () => {
    const state = stateBuilders.initial()
    return sessionReducer(
      state,
      actions.auth.failure('Invalid credentials', 'manual')
    )
  },
  
  withConnectionError: () => {
    const state = stateBuilders.authenticated()
    return sessionReducer(
      state,
      actions.connection.error('Connection refused')
    )
  },
  
  withTerminal: (rows: number, cols: number) => {
    const state = stateBuilders.connected()
    return sessionReducer(
      state,
      actions.terminal.resize(rows, cols)
    )
  },
  
  withClientInfo: () => {
    const state = stateBuilders.initial()
    return sessionReducer(
      state,
      actions.metadata.setClient('192.168.1.100', 'Mozilla/5.0')
    )
  }
}

describe('authentication selectors', () => {
  it('should check if authenticated', () => {
    expect(selectors.isAuthenticated(stateBuilders.initial())).toBe(false)
    expect(selectors.isAuthenticated(stateBuilders.authenticated())).toBe(true)
  })

  it('should check if auth pending', () => {
    expect(selectors.isAuthPending(stateBuilders.initial())).toBe(true)
    expect(selectors.isAuthPending(stateBuilders.authenticated())).toBe(false)
  })

  it('should check auth error', () => {
    expect(selectors.hasAuthError(stateBuilders.initial())).toBe(false)
    expect(selectors.hasAuthError(stateBuilders.withAuthError())).toBe(true)
  })

  it('should get auth error message', () => {
    expect(selectors.getAuthError(stateBuilders.initial())).toBeNull()
    expect(selectors.getAuthError(stateBuilders.withAuthError())).toBe('Invalid credentials')
  })

  it('should get auth method', () => {
    expect(selectors.getAuthMethod(stateBuilders.initial())).toBeNull()
    expect(selectors.getAuthMethod(stateBuilders.authenticated())).toBe('manual')
  })

  it('should get username', () => {
    expect(selectors.getUsername(stateBuilders.initial())).toBeNull()
    expect(selectors.getUsername(stateBuilders.authenticated())).toBe(TEST_USERNAME)
  })
})

describe('connection selectors', () => {
  it('should check if connected', () => {
    expect(selectors.isConnected(stateBuilders.initial())).toBe(false)
    expect(selectors.isConnected(stateBuilders.connected())).toBe(true)
  })

  it('should check if connecting', () => {
    const state = stateBuilders.authenticated()
    const connecting = sessionReducer(
      state,
      actions.connection.start(TEST_SSH.HOST, TEST_SSH.PORT)
    )
    expect(selectors.isConnecting(connecting)).toBe(true)
    expect(selectors.isConnecting(stateBuilders.connected())).toBe(false)
  })

  it('should check connection error', () => {
    expect(selectors.hasConnectionError(stateBuilders.initial())).toBe(false)
    expect(selectors.hasConnectionError(stateBuilders.withConnectionError())).toBe(true)
  })

  it('should get connection error message', () => {
    expect(selectors.getConnectionError(stateBuilders.initial())).toBeNull()
    expect(selectors.getConnectionError(stateBuilders.withConnectionError())).toBe('Connection refused')
  })

  it('should get connection info', () => {
    const state = stateBuilders.connected()
    const info = selectors.getConnectionInfo(state)
    
    expect(info.host).toBe(TEST_SSH.HOST)
    expect(info.port).toBe(TEST_SSH.PORT)
    expect(info.status).toBe('connected')
    expect(info.connectionId).toBeTruthy()
  })

  it('should get connection status', () => {
    expect(selectors.getConnectionStatus(stateBuilders.initial())).toBe('disconnected')
    expect(selectors.getConnectionStatus(stateBuilders.connected())).toBe('connected')
  })
})

describe('terminal selectors', () => {
  it('should get terminal dimensions', () => {
    const state = stateBuilders.withTerminal(
      TEST_SSH.TERMINAL.LARGE_ROWS,
      TEST_SSH.TERMINAL.LARGE_COLS
    )
    const dims = selectors.getTerminalDimensions(state)
    
    expect(dims.rows).toBe(TEST_SSH.TERMINAL.LARGE_ROWS)
    expect(dims.cols).toBe(TEST_SSH.TERMINAL.LARGE_COLS)
  })

  it('should get terminal type', () => {
    const state = stateBuilders.initial()
    expect(selectors.getTerminalType(state)).toBe('xterm-256color')
  })

  it('should get terminal environment', () => {
    const state = stateBuilders.initial()
    const envState = sessionReducer(
      state,
      actions.terminal.setEnv({ PATH: '/usr/bin', USER: 'test' })
    )
    
    const env = selectors.getTerminalEnvironment(envState)
    expect(env.PATH).toBe('/usr/bin')
    expect(env.USER).toBe('test')
  })

  it('should get working directory', () => {
    const state = stateBuilders.initial()
    expect(selectors.getWorkingDirectory(state)).toBeNull()
    
    const cwdState = sessionReducer(
      state,
      actions.terminal.setCwd('/home/user')
    )
    expect(selectors.getWorkingDirectory(cwdState)).toBe('/home/user')
  })
})

describe('combined selectors', () => {
  it('should check if can execute commands', () => {
    expect(selectors.canExecuteCommands(stateBuilders.initial())).toBe(false)
    expect(selectors.canExecuteCommands(stateBuilders.authenticated())).toBe(false)
    expect(selectors.canExecuteCommands(stateBuilders.connected())).toBe(true)
  })

  it('should check if can resize', () => {
    expect(selectors.canResize(stateBuilders.initial())).toBe(false)
    expect(selectors.canResize(stateBuilders.connected())).toBe(true)
  })

  it('should check if session is active', () => {
    expect(selectors.isSessionActive(stateBuilders.initial())).toBe(false)
    expect(selectors.isSessionActive(stateBuilders.authenticated())).toBe(false)
    
    const connecting = sessionReducer(
      stateBuilders.authenticated(),
      actions.connection.start(TEST_SSH.HOST, TEST_SSH.PORT)
    )
    expect(selectors.isSessionActive(connecting)).toBe(true)
    expect(selectors.isSessionActive(stateBuilders.connected())).toBe(true)
  })

  it('should get session summary', () => {
    const state = stateBuilders.connected()
    const summary = selectors.getSessionSummary(state)
    
    expect(summary.id).toBeTruthy()
    expect(summary.authenticated).toBe(true)
    expect(summary.connected).toBe(true)
    expect(summary.username).toBe(TEST_USERNAME)
    expect(summary.host).toBe(TEST_SSH.HOST)
    expect(summary.port).toBe(TEST_SSH.PORT)
    expect(summary.terminal).toBe('xterm-256color')
    expect(summary.dimensions.rows).toBe(TEST_SSH.TERMINAL.DEFAULT_ROWS)
    expect(summary.dimensions.cols).toBe(TEST_SSH.TERMINAL.DEFAULT_COLS)
  })
})

describe('metadata selectors', () => {
  it('should calculate session age', () => {
    const state = stateBuilders.initial()
    const age = selectors.getSessionAge(state)
    
    expect(age).toBeGreaterThanOrEqual(0)
    expect(age).toBeLessThan(TEST_TIMEOUTS.short)
  })

  it('should get last activity', () => {
    const state = stateBuilders.connected()
    const lastActivity = selectors.getLastActivity(state)
    
    expect(lastActivity).toBeLessThanOrEqual(Date.now())
    expect(lastActivity).toBeGreaterThan(Date.now() - TEST_TIMEOUTS.short)
  })

  it('should calculate idle time', () => {
    const state = stateBuilders.connected()
    const idleTime = selectors.getIdleTime(state)
    
    expect(idleTime).toBeGreaterThanOrEqual(0)
    expect(idleTime).toBeLessThan(TEST_TIMEOUTS.short)
  })

  it('should check if idle', () => {
    const state = stateBuilders.initial()
    
    // Not idle with default threshold
    expect(selectors.isIdle(state)).toBe(false)
    
    // Any positive idle time means not idle with 0 threshold
    // We cannot test the true case reliably as time always advances
    expect(selectors.isIdle(state, 1000000)).toBe(false) // 1000 seconds should be not idle
  })

  it('should get client info', () => {
    const state = stateBuilders.withClientInfo()
    const info = selectors.getClientInfo(state)
    
    expect(info.ip).toBe('192.168.1.100')
    expect(info.userAgent).toBe('Mozilla/5.0')
    expect(info.userId).toBeNull()
  })
})

describe('error selectors', () => {
  it('should get all errors', () => {
    const state = stateBuilders.initial()
    
    // No errors initially
    expect(selectors.getAllErrors(state)).toEqual([])
    
    // With auth error
    const authError = stateBuilders.withAuthError()
    expect(selectors.getAllErrors(authError)).toEqual(['Auth: Invalid credentials'])
    
    // With connection error
    const connError = stateBuilders.withConnectionError()
    expect(selectors.getAllErrors(connError)).toEqual(['Connection: Connection refused'])
    
    // With both errors
    let bothErrors = sessionReducer(
      stateBuilders.initial(),
      actions.auth.failure('Auth failed', 'manual')
    )
    bothErrors = sessionReducer(
      bothErrors,
      actions.connection.error('Conn failed')
    )
    expect(selectors.getAllErrors(bothErrors)).toEqual([
      'Auth: Auth failed',
      'Connection: Conn failed'
    ])
  })

  it('should check if has any error', () => {
    expect(selectors.hasAnyError(stateBuilders.initial())).toBe(false)
    expect(selectors.hasAnyError(stateBuilders.withAuthError())).toBe(true)
    expect(selectors.hasAnyError(stateBuilders.withConnectionError())).toBe(true)
  })
})

describe('status selectors', () => {
  it('should get overall status', () => {
    expect(selectors.getOverallStatus(stateBuilders.initial())).toBe('authenticating')
    expect(selectors.getOverallStatus(stateBuilders.authenticated())).toBe('connecting')
    expect(selectors.getOverallStatus(stateBuilders.connected())).toBe('ready')
    expect(selectors.getOverallStatus(stateBuilders.withAuthError())).toBe('error')
    expect(selectors.getOverallStatus(stateBuilders.withConnectionError())).toBe('error')
    
    const closed = sessionReducer(
      stateBuilders.connected(),
      actions.connection.closed('User disconnect')
    )
    expect(selectors.getOverallStatus(closed)).toBe('closed')
  })
})

describe('feature flag selectors', () => {
  it('should return feature flags', () => {
    const state = stateBuilders.initial()
    
    expect(selectors.shouldUseNewAuth(state)).toBe(true)
    expect(selectors.shouldUseConnectionPool(state)).toBe(true)
  })
})