/**
 * Terminal state reducer
 */

import type { TerminalState } from '../types.js'
import type { SessionAction } from '../actions.js'

/**
 * Terminal reducer - handles terminal state transitions
 */
export const terminalReducer = (
  state: TerminalState,
  action: SessionAction
): TerminalState => {
  switch (action.type) {
    case 'TERMINAL_RESIZE':
      return {
        ...state,
        rows: action.payload.rows,
        cols: action.payload.cols
      }
    
    case 'TERMINAL_SET_TERM':
      return {
        ...state,
        term: action.payload.term
      }
    
    case 'TERMINAL_SET_ENV':
      return {
        ...state,
        environment: { ...action.payload.environment }
      }
    
    case 'TERMINAL_SET_CWD':
      return {
        ...state,
        cwd: action.payload.cwd
      }
    
    // Ignore non-terminal actions
    case 'AUTH_REQUEST':
    case 'AUTH_SUCCESS':
    case 'AUTH_FAILURE':
    case 'AUTH_LOGOUT':
    case 'AUTH_CLEAR_ERROR':
    case 'CONNECTION_START':
    case 'CONNECTION_ESTABLISHED':
    case 'CONNECTION_ERROR':
    case 'CONNECTION_CLOSED':
    case 'CONNECTION_ACTIVITY':
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