/**
 * Connection state reducer
 */

import type { ConnectionState } from '../types.js'
import type { SessionAction } from '../actions.js'

/**
 * Connection reducer - handles SSH connection state transitions
 */
export const connectionReducer = (
  state: ConnectionState,
  action: SessionAction
): ConnectionState => {
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
    
    // Reset connection on auth failure
    case 'AUTH_FAILURE':
    case 'AUTH_LOGOUT':
      return {
        status: 'disconnected',
        connectionId: null,
        host: state.host,
        port: state.port,
        errorMessage: null,
        lastActivity: Date.now()
      }
    
    // Ignore non-connection actions
    case 'AUTH_REQUEST':
    case 'AUTH_SUCCESS':
    case 'AUTH_CLEAR_ERROR':
    case 'TERMINAL_INIT':
    case 'TERMINAL_RESIZE':
    case 'TERMINAL_SET_TERM':
    case 'TERMINAL_SET_ENV':
    case 'TERMINAL_UPDATE_ENV':
    case 'TERMINAL_SET_CWD':
    case 'TERMINAL_DESTROY':
    case 'METADATA_SET_CLIENT':
    case 'METADATA_UPDATE':
    case 'METADATA_UPDATE_TIMESTAMP':
    case 'SESSION_RESET':
    case 'SESSION_END':
      return state
    
    default:
      return state
  }
}