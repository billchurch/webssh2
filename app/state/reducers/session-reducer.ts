/**
 * Root session reducer combining all sub-reducers
 */

import { createInitialState, type SessionState } from '../types.js'
import type { SessionAction } from '../actions.js'
import { authReducer } from './auth-reducer.js'
import { connectionReducer } from './connection-reducer.js'
import { terminalReducer } from './terminal-reducer.js'
import { metadataReducer } from './metadata-reducer.js'

/**
 * Main session reducer - combines all sub-reducers
 */
export const sessionReducer = (
  state: SessionState,
  action: SessionAction
): SessionState => {
  if (action.type === 'SESSION_RESET') {
    return createInitialState(state.id)
  }

  if (action.type === 'SESSION_END') {
    return applySessionEnd(state)
  }

  return reduceSubReducers(state, action)
}

function applySessionEnd(state: SessionState): SessionState {
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
}

function reduceSubReducers(state: SessionState, action: SessionAction): SessionState {
  const newAuth = authReducer(state.auth, action)
  const newConnection = connectionReducer(state.connection, action)
  const newTerminal = terminalReducer(state.terminal, action)
  const newMetadata = metadataReducer(state.metadata, action)

  if (
    newAuth === state.auth &&
    newConnection === state.connection &&
    newTerminal === state.terminal &&
    newMetadata === state.metadata
  ) {
    return state
  }

  return {
    id: state.id,
    auth: newAuth,
    connection: newConnection,
    terminal: newTerminal,
    metadata: newMetadata
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
