/**
 * Terminal state reducer
 */

import type { TerminalState } from '../types.js'
import type { SessionAction, TerminalAction } from '../actions.js'
import { TERMINAL_DEFAULTS } from '../../constants/index.js'

const terminalActionTypes = new Set<TerminalAction['type']>([
  'TERMINAL_INIT',
  'TERMINAL_RESIZE',
  'TERMINAL_SET_TERM',
  'TERMINAL_SET_ENV',
  'TERMINAL_UPDATE_ENV',
  'TERMINAL_SET_CWD',
  'TERMINAL_DESTROY'
])

function isTerminalAction(action: SessionAction): action is TerminalAction {
  return terminalActionTypes.has(action.type as TerminalAction['type'])
}

function applyTerminalAction(state: TerminalState, action: TerminalAction): TerminalState {
  switch (action.type) {
    case 'TERMINAL_INIT':
      return {
        term: action.payload.term,
        rows: action.payload.rows,
        cols: action.payload.cols,
        environment: { ...action.payload.environment },
        cwd: action.payload.cwd
      }

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

    case 'TERMINAL_UPDATE_ENV':
      return {
        ...state,
        environment: { ...state.environment, ...action.payload.environment }
      }

    case 'TERMINAL_SET_CWD':
      return {
        ...state,
        cwd: action.payload.cwd
      }

    case 'TERMINAL_DESTROY':
      return {
        term: TERMINAL_DEFAULTS.DEFAULT_TERM,
        rows: TERMINAL_DEFAULTS.DEFAULT_ROWS,
        cols: TERMINAL_DEFAULTS.DEFAULT_COLS,
        environment: {},
        cwd: null
      }

    default:
      return state
  }
}

/**
 * Terminal reducer - handles terminal state transitions
 */
export const terminalReducer = (
  state: TerminalState,
  action: SessionAction
): TerminalState => {
  if (isTerminalAction(action)) {
    return applyTerminalAction(state, action)
  }

  return state
}
