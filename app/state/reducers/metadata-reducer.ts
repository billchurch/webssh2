/**
 * Metadata state reducer
 */

import type { SessionMetadata } from '../types.js'
import type { SessionAction } from '../actions.js'

/**
 * Metadata reducer - handles session metadata state transitions
 */
export const metadataReducer = (
  state: SessionMetadata,
  action: SessionAction
): SessionMetadata => {
  switch (action.type) {
    case 'METADATA_SET_CLIENT':
      return {
        ...state,
        clientIp: action.payload.clientIp,
        userAgent: action.payload.userAgent,
        updatedAt: Date.now()
      }
    
    case 'METADATA_UPDATE':
      return {
        ...state,
        ...(action.payload.userId !== undefined && { userId: action.payload.userId }),
        ...(action.payload.clientIp !== undefined && { clientIp: action.payload.clientIp }),
        ...(action.payload.userAgent !== undefined && { userAgent: action.payload.userAgent }),
        updatedAt: action.payload.updatedAt ?? Date.now()
      }
    
    case 'METADATA_UPDATE_TIMESTAMP':
    case 'CONNECTION_ACTIVITY':
    case 'TERMINAL_RESIZE':
      return {
        ...state,
        updatedAt: Date.now()
      }

    // Update userId on successful auth
    case 'AUTH_SUCCESS':
      return {
        ...state,
        userId: action.payload.userId ?? null,
        updatedAt: Date.now()
      }
    
    // Ignore non-metadata actions
    case 'AUTH_REQUEST':
    case 'AUTH_FAILURE':
    case 'AUTH_LOGOUT':
    case 'AUTH_CLEAR_ERROR':
    case 'CONNECTION_START':
    case 'CONNECTION_ESTABLISHED':
    case 'CONNECTION_ERROR':
    case 'CONNECTION_CLOSED':
    case 'TERMINAL_INIT':
    case 'TERMINAL_SET_TERM':
    case 'TERMINAL_SET_ENV':
    case 'TERMINAL_UPDATE_ENV':
    case 'TERMINAL_SET_CWD':
    case 'TERMINAL_DESTROY':
    case 'SESSION_RESET':
    case 'SESSION_END':
      return state
    
    default:
      return state
  }
}