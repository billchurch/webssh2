/**
 * Centralized state store for session management
 */

import type { SessionId } from '../types/branded.js'
import type { SessionState, StateListener } from './types.js'
import type { SessionAction } from './actions.js'
import { createInitialState } from './types.js'
import { sessionReducer, hasStateChanged } from './reducers/session-reducer.js'
import debug from 'debug'

const logger = debug('webssh2:state')

/**
 * Session state store with subscription mechanism
 */
export class SessionStore {
  private readonly states = new Map<SessionId, SessionState>()
  private readonly listeners = new Map<SessionId, Set<StateListener>>()
  private readonly actionHistory = new Map<SessionId, SessionAction[]>()
  private readonly maxHistorySize: number

  constructor(options: { maxHistorySize?: number } = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 100
  }

  /**
   * Create a new session with initial state
   */
  createSession(sessionId: SessionId): SessionState {
    const existing = this.states.get(sessionId)
    if (existing !== undefined) {
      logger('Session already exists:', sessionId)
      return existing
    }

    const initialState = createInitialState(sessionId)
    this.states.set(sessionId, initialState)
    this.actionHistory.set(sessionId, [])
    logger('Created new session:', sessionId)
    return initialState
  }

  /**
   * Get current state for a session
   */
  getState(sessionId: SessionId): SessionState | undefined {
    return this.states.get(sessionId)
  }

  /**
   * Get all active session IDs
   */
  getSessionIds(): SessionId[] {
    return Array.from(this.states.keys())
  }

  /**
   * Dispatch an action to update session state
   */
  dispatch(sessionId: SessionId, action: SessionAction): void {
    const currentState = this.states.get(sessionId)
    if (currentState === undefined) {
      logger('Cannot dispatch to non-existent session:', sessionId)
      return
    }

    logger('Dispatching action:', action.type, 'for session:', sessionId)
    
    // Apply reducer
    const newState = sessionReducer(currentState, action)
    
    // Only update if state actually changed
    if (hasStateChanged(currentState, newState)) {
      this.states.set(sessionId, newState)
      this.recordAction(sessionId, action)
      this.notifyListeners(sessionId, newState, currentState)
      logger('State updated for session:', sessionId)
    } else {
      logger('No state change for action:', action.type)
    }
  }

  /**
   * Subscribe to state changes for a session
   */
  subscribe(
    sessionId: SessionId,
    listener: StateListener
  ): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(sessionId, listeners)
    
    logger('Added listener for session:', sessionId, '(total:', listeners.size, ')')
    
    // Return unsubscribe function
    return () => {
      const sessionListeners = this.listeners.get(sessionId)
      if (sessionListeners !== undefined) {
        sessionListeners.delete(listener)
        if (sessionListeners.size === 0) {
          this.listeners.delete(sessionId)
        }
        logger('Removed listener for session:', sessionId)
      }
    }
  }

  /**
   * Remove a session and clean up resources
   */
  removeSession(sessionId: SessionId): void {
    const state = this.states.get(sessionId)
    if (state === undefined) {
      return
    }

    // Dispatch session end action
    this.dispatch(sessionId, { type: 'SESSION_END' })
    
    // Clean up
    this.states.delete(sessionId)
    this.listeners.delete(sessionId)
    this.actionHistory.delete(sessionId)
    
    logger('Removed session:', sessionId)
  }

  /**
   * Get action history for debugging
   */
  getActionHistory(sessionId: SessionId): SessionAction[] {
    return this.actionHistory.get(sessionId) ?? []
  }

  /**
   * Clear all sessions (for testing)
   */
  clear(): void {
    this.states.clear()
    this.listeners.clear()
    this.actionHistory.clear()
    logger('Store cleared')
  }

  /**
   * Get store statistics
   */
  getStats(): {
    sessionCount: number
    listenerCount: number
    totalActions: number
  } {
    let listenerCount = 0
    let totalActions = 0
    
    for (const listeners of this.listeners.values()) {
      listenerCount += listeners.size
    }
    
    for (const actions of this.actionHistory.values()) {
      totalActions += actions.length
    }
    
    return {
      sessionCount: this.states.size,
      listenerCount,
      totalActions
    }
  }

  /**
   * Notify listeners of state change
   */
  private notifyListeners(
    sessionId: SessionId,
    newState: SessionState,
    oldState: SessionState
  ): void {
    const listeners = this.listeners.get(sessionId)
    if (listeners === undefined || listeners.size === 0) {
      return
    }

    logger('Notifying', listeners.size, 'listeners for session:', sessionId)
    
    for (const listener of listeners) {
      try {
        listener(newState, oldState)
      } catch (error) {
        logger('Error in state listener:', error)
      }
    }
  }

  /**
   * Record action in history
   */
  private recordAction(sessionId: SessionId, action: SessionAction): void {
    const history = this.actionHistory.get(sessionId) ?? []
    history.push(action)
    
    // Limit history size
    if (history.length > this.maxHistorySize) {
      history.shift()
    }
    
    this.actionHistory.set(sessionId, history)
  }
}

/**
 * Module-level singleton for session store management.
 *
 * Lifecycle:
 * - Lazily initialized on first getStore() call
 * - Maintains session state across socket connections
 * - Provides centralized session lifecycle management
 * - Reset via resetStore() in test environments only
 *
 * Thread Safety:
 * - Safe for concurrent access in Node.js single-threaded event loop
 * - All operations are synchronous within the event loop tick
 *
 * @internal
 */
let storeInstance: SessionStore | null = null

/**
 * Get singleton store instance
 */
export const getStore = (): SessionStore => {
  storeInstance ??= new SessionStore()
  return storeInstance
}

/**
 * Reset store (for testing)
 */
export const resetStore = (): void => {
  if (storeInstance !== null) {
    storeInstance.clear()
  }
  storeInstance = null
}