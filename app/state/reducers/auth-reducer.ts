/**
 * Authentication state reducer
 */

import type { AuthState } from '../types.js'
import type { SessionAction } from '../actions.js'

/**
 * Auth reducer - handles authentication state transitions
 */
type AuthActionType = SessionAction['type']

const resetStatusActions = new Set<AuthActionType>(['CONNECTION_ERROR', 'CONNECTION_CLOSED'])

const noOpActions = new Set<AuthActionType>([
  'CONNECTION_START',
  'CONNECTION_ESTABLISHED',
  'CONNECTION_ACTIVITY',
  'TERMINAL_INIT',
  'TERMINAL_RESIZE',
  'TERMINAL_SET_TERM',
  'TERMINAL_SET_ENV',
  'TERMINAL_UPDATE_ENV',
  'TERMINAL_SET_CWD',
  'TERMINAL_DESTROY',
  'METADATA_SET_CLIENT',
  'METADATA_UPDATE',
  'METADATA_UPDATE_TIMESTAMP',
  'SESSION_RESET',
  'SESSION_END'
])

export const authReducer = (
  state: AuthState,
  action: SessionAction
): AuthState => {
  if (isAuthAction(action, 'AUTH_REQUEST')) {
    return {
      ...state,
      status: 'pending',
      method: action.payload.method as AuthState['method'],
      username: action.payload.username ?? state.username,
      errorMessage: null
    }
  }

  if (isAuthAction(action, 'AUTH_SUCCESS')) {
    return {
      status: 'authenticated',
      method: action.payload.method as AuthState['method'],
      username: action.payload.username,
      timestamp: Date.now(),
      errorMessage: null
    }
  }

  if (isAuthAction(action, 'AUTH_FAILURE')) {
    return {
      ...state,
      status: 'failed',
      method: action.payload.method as AuthState['method'],
      errorMessage: action.payload.error,
      timestamp: Date.now()
    }
  }

  if (isAuthAction(action, 'AUTH_LOGOUT')) {
    return {
      status: 'pending',
      method: null,
      username: null,
      timestamp: Date.now(),
      errorMessage: null
    }
  }

  if (isAuthAction(action, 'AUTH_CLEAR_ERROR')) {
    return {
      ...state,
      errorMessage: null
    }
  }

  if (resetStatusActions.has(action.type)) {
    const status = state.status === 'authenticated' ? 'pending' : state.status
    return {
      ...state,
      status
    }
  }

  if (noOpActions.has(action.type)) {
    return state
  }

  return state
}

function isAuthAction<Type extends AuthActionType>(
  action: SessionAction,
  type: Type
): action is Extract<SessionAction, { type: Type }> {
  return action.type === type
}
