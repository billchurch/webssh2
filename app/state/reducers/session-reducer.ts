/**
 * Root session reducer combining all sub-reducers
 */

import type { SessionState } from '../types.js'
import type { SessionAction } from '../actions.js'
import { authReducer } from './auth-reducer.js'
import { connectionReducer } from './connection-reducer.js'
import { terminalReducer } from './terminal-reducer.js'
import { metadataReducer } from './metadata-reducer.js'
import { createInitialState } from '../types.js'

/**
 * Main session reducer - combines all sub-reducers
 */
export const sessionReducer = (
  state: SessionState,
  action: SessionAction
): SessionState => {
  // Handle session-level actions
  switch (action.type) {
    case 'SESSION_RESET':
      return createInitialState(state.id)
    
    case 'SESSION_END':
      return {
        ...state,
        connection: {
          ...state.connection,
          status: 'closed',
          connectionId: null,
          errorMessage: 'Session ended'
        },
        auth: {
          ...state.auth,
          status: 'pending',
          username: null
        }
      }
    
    default: {
      // Delegate to sub-reducers
      const newAuth = authReducer(state.auth, action)
      const newConnection = connectionReducer(state.connection, action)
      const newTerminal = terminalReducer(state.terminal, action)
      const newMetadata = metadataReducer(state.metadata, action)
      
      // Only create new object if something changed
      if (
        newAuth !== state.auth ||
        newConnection !== state.connection ||
        newTerminal !== state.terminal ||
        newMetadata !== state.metadata
      ) {
        return {
          id: state.id,
          auth: newAuth,
          connection: newConnection,
          terminal: newTerminal,
          metadata: newMetadata
        }
      }
      return state
    }
  }
}

/**
 * Helper to check if state actually changed
 */
export const hasStateChanged = (
  oldState: SessionState,
  newState: SessionState
): boolean => {
  return oldState !== newState
}