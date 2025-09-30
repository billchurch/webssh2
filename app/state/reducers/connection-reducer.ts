/**
 * Connection state reducer
 */

import type { ConnectionState } from '../types.js'
import type { ConnectionAction, SessionAction } from '../actions.js'

const connectionActionTypes = new Set<ConnectionAction['type']>([
  'CONNECTION_START',
  'CONNECTION_ESTABLISHED',
  'CONNECTION_ERROR',
  'CONNECTION_CLOSED',
  'CONNECTION_ACTIVITY'
])

function isConnectionAction(action: SessionAction): action is ConnectionAction {
  return connectionActionTypes.has(action.type as ConnectionAction['type'])
}

function isConnectionResetAction(action: SessionAction): boolean {
  return action.type === 'AUTH_FAILURE' || action.type === 'AUTH_LOGOUT'
}

function resetConnectionState(state: ConnectionState): ConnectionState {
  return {
    status: 'disconnected',
    connectionId: null,
    host: state.host,
    port: state.port,
    errorMessage: null,
    lastActivity: Date.now()
  }
}

function applyConnectionHandler(state: ConnectionState, action: ConnectionAction): ConnectionState {
  switch (action.type) {
    case 'CONNECTION_START':
      return {
        ...state,
        status: 'connecting',
        host: action.payload.host,
        port: action.payload.port,
        errorMessage: null,
        lastActivity: Date.now()
      }

    case 'CONNECTION_ESTABLISHED':
      return {
        ...state,
        status: 'connected',
        connectionId: action.payload.connectionId,
        errorMessage: null,
        lastActivity: Date.now()
      }

    case 'CONNECTION_ERROR':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload.error,
        lastActivity: Date.now()
      }

    case 'CONNECTION_CLOSED':
      return {
        ...state,
        status: 'closed',
        connectionId: null,
        errorMessage: action.payload.reason ?? null,
        lastActivity: Date.now()
      }

    case 'CONNECTION_ACTIVITY':
      return {
        ...state,
        lastActivity: Date.now()
      }

    default:
      return state
  }
}

/**
 * Connection reducer - handles SSH connection state transitions
 */
export const connectionReducer = (
  state: ConnectionState,
  action: SessionAction
): ConnectionState => {
  if (isConnectionAction(action)) {
    return applyConnectionHandler(state, action)
  }

  if (isConnectionResetAction(action)) {
    return resetConnectionState(state)
  }

  return state
}
