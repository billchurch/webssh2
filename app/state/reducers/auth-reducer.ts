/**
 * Authentication state reducer
 */

import type { AuthState } from '../types.js'
import type { SessionAction } from '../actions.js'

/**
 * Auth reducer - handles authentication state transitions
 */
export const authReducer = (
  state: AuthState,
  action: SessionAction
): AuthState => {
  switch (action.type) {
    case 'AUTH_REQUEST':
      return {
        ...state,
        status: 'pending',
        method: action.payload.method as AuthState['method'],
        username: action.payload.username ?? state.username,
        errorMessage: null
      }
    
    case 'AUTH_SUCCESS':
      return {
        status: 'authenticated',
        method: action.payload.method as AuthState['method'],
        username: action.payload.username,
        timestamp: Date.now(),
        errorMessage: null
      }
    
    case 'AUTH_FAILURE':
      return {
        ...state,
        status: 'failed',
        method: action.payload.method as AuthState['method'],
        errorMessage: action.payload.error,
        timestamp: Date.now()
      }
    
    case 'AUTH_LOGOUT':
      return {
        status: 'pending',
        method: null,
        username: null,
        timestamp: Date.now(),
        errorMessage: null
      }
    
    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        errorMessage: null
      }
    
    // Reset auth on connection errors
    case 'CONNECTION_ERROR':
    case 'CONNECTION_CLOSED':
      return {
        ...state,
        status: state.status === 'authenticated' ? 'pending' : state.status
      }
    
    // Ignore non-auth actions
    case 'CONNECTION_START':
    case 'CONNECTION_ESTABLISHED':
    case 'CONNECTION_ACTIVITY':
    case 'TERMINAL_RESIZE':
    case 'TERMINAL_SET_TERM':
    case 'TERMINAL_SET_ENV':
    case 'TERMINAL_SET_CWD':
    case 'METADATA_SET_CLIENT':
    case 'METADATA_UPDATE_TIMESTAMP':
    case 'SESSION_RESET':
    case 'SESSION_END':
      return state
    
    default: {
      const exhaustiveCheck: never = action
      void exhaustiveCheck
      return state
    }
  }
}