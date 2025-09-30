/**
 * Session service implementation
 */

import { randomUUID } from 'node:crypto'
import type {
  SessionService,
  Session,
  SessionParams,
  ServiceDependencies
} from '../interfaces.js'
import type { SessionId } from '../../types/branded.js'
import type { SessionState, Result } from '../../state/types.js'
import { ok, err } from '../../state/types.js'
import { createSessionId } from '../../types/branded.js'
import type { SessionStore } from '../../state/store.js'
import debug from 'debug'

const logger = debug('webssh2:services:session')

export class SessionServiceImpl implements SessionService {
  constructor(
    private readonly deps: ServiceDependencies,
    private readonly store: SessionStore
  ) {}

  /**
   * Create a session
   */
  create(params: SessionParams): Result<Session> {
    try {
      // Generate or use provided session ID
      const sessionId = params.id ?? createSessionId(randomUUID())
      
      logger('Creating session:', sessionId)

      // Check if session already exists
      let state = this.store.getState(sessionId)
      if (state !== undefined) {
        logger('Session already exists:', sessionId)
        return ok({
          id: sessionId,
          state,
          createdAt: state.metadata.createdAt,
          updatedAt: state.metadata.updatedAt
        })
      }

      // Create new session
      state = this.store.createSession(sessionId)

      // Update metadata if provided
      if (params.userId !== undefined || params.clientIp !== undefined || params.userAgent !== undefined) {
        this.store.dispatch(sessionId, {
          type: 'METADATA_UPDATE',
          payload: {
            userId: params.userId ?? null,
            clientIp: params.clientIp ?? null,
            userAgent: params.userAgent ?? null,
            updatedAt: Date.now()
          }
        })
        
        // Get updated state
        state = this.store.getState(sessionId) as SessionState
      }

      const session: Session = {
        id: sessionId,
        state,
        createdAt: state.metadata.createdAt,
        updatedAt: state.metadata.updatedAt
      }

      logger('Session created:', sessionId)
      return ok(session)
    } catch (error) {
      logger('Failed to create session:', error)
      return err(error instanceof Error ? error : new Error('Failed to create session'))
    }
  }

  /**
   * Get a session
   */
  get(id: SessionId): Result<Session | null> {
    try {
      const state = this.store.getState(id)
      if (state === undefined) {
        return ok(null)
      }

      const session: Session = {
        id,
        state,
        createdAt: state.metadata.createdAt,
        updatedAt: state.metadata.updatedAt
      }

      return ok(session)
    } catch (error) {
      logger('Failed to get session:', error)
      return err(error instanceof Error ? error : new Error('Failed to get session'))
    }
  }

  /**
   * Update a session
   */
  update(id: SessionId, updates: Partial<SessionState>): Result<Session> {
    try {
      const state = this.store.getState(id)
      if (state === undefined) {
        return err(new Error('Session not found'))
      }

      logger('Updating session:', id)

      // Apply updates using helper methods
      if (updates.auth !== undefined) {
        this.applyAuthUpdates(id, state, updates.auth)
      }

      if (updates.connection !== undefined) {
        this.applyConnectionUpdates(id, state, updates.connection)
      }

      if (updates.terminal !== undefined) {
        this.applyTerminalUpdates(id, updates.terminal)
      }

      if (updates.metadata !== undefined) {
        this.applyMetadataUpdates(id, updates.metadata)
      }

      // Get updated state
      const updatedState = this.store.getState(id) as SessionState
      const session: Session = {
        id,
        state: updatedState,
        createdAt: updatedState.metadata.createdAt,
        updatedAt: updatedState.metadata.updatedAt
      }

      logger('Session updated:', id)
      return ok(session)
    } catch (error) {
      logger('Failed to update session:', error)
      return err(error instanceof Error ? error : new Error('Failed to update session'))
    }
  }

  /**
   * Apply auth updates to a session
   */
  private applyAuthUpdates(
    id: SessionId,
    state: SessionState,
    auth: Partial<SessionState['auth']>
  ): void {
    if (auth.status === undefined) {
      return
    }

    if (auth.status === 'authenticated') {
      this.store.dispatch(id, {
        type: 'AUTH_SUCCESS',
        payload: {
          username: auth.username ?? state.auth.username ?? '',
          method: auth.method ?? state.auth.method ?? 'manual'
        }
      })
    } else if (auth.status === 'failed') {
      this.store.dispatch(id, {
        type: 'AUTH_FAILURE',
        payload: {
          error: auth.errorMessage ?? 'Authentication failed',
          method: auth.method ?? state.auth.method ?? 'manual'
        }
      })
    }
  }

  /**
   * Apply connection updates to a session
   */
  private applyConnectionUpdates(
    id: SessionId,
    state: SessionState,
    connection: Partial<SessionState['connection']>
  ): void {
    const status = connection.status
    if (status === undefined) {
      return
    }

    switch (status) {
      case 'connecting':
        this.dispatchConnectionStart(id, state, connection)
        break
      case 'connected':
        this.dispatchConnectionEstablished(id, connection)
        break
      case 'error':
        this.dispatchConnectionError(id, connection)
        break
      case 'closed':
        this.dispatchConnectionClosed(id)
        break
      case 'disconnected':
        break
      default:
        break
    }
  }

  private dispatchConnectionStart(
    id: SessionId,
    state: SessionState,
    connection: Partial<SessionState['connection']>
  ): void {
    this.store.dispatch(id, {
      type: 'CONNECTION_START',
      payload: {
        host: connection.host ?? state.connection.host ?? '',
        port: connection.port ?? state.connection.port ?? 22
      }
    })
  }

  private dispatchConnectionEstablished(
    id: SessionId,
    connection: Partial<SessionState['connection']>
  ): void {
    const connectionId = connection.connectionId
    if (connectionId === undefined || connectionId === null) {
      return
    }

    this.store.dispatch(id, {
      type: 'CONNECTION_ESTABLISHED',
      payload: { connectionId }
    })
  }

  private dispatchConnectionError(
    id: SessionId,
    connection: Partial<SessionState['connection']>
  ): void {
    this.store.dispatch(id, {
      type: 'CONNECTION_ERROR',
      payload: {
        error: connection.errorMessage ?? 'Connection failed'
      }
    })
  }

  private dispatchConnectionClosed(id: SessionId): void {
    this.store.dispatch(id, {
      type: 'CONNECTION_CLOSED',
      payload: {}
    })
  }

  /**
   * Apply terminal updates to a session
   */
  private applyTerminalUpdates(
    id: SessionId,
    terminal: Partial<SessionState['terminal']>
  ): void {
    const { rows, cols, environment } = terminal

    if (rows !== undefined && cols !== undefined) {
      this.store.dispatch(id, {
        type: 'TERMINAL_RESIZE',
        payload: { rows, cols }
      })
    }

    if (environment !== undefined) {
      this.store.dispatch(id, {
        type: 'TERMINAL_SET_ENV',
        payload: { environment }
      })
    }
  }

  /**
   * Apply metadata updates to a session
   */
  private applyMetadataUpdates(
    id: SessionId,
    metadata: Partial<SessionState['metadata']>
  ): void {
    this.store.dispatch(id, {
      type: 'METADATA_UPDATE',
      payload: {
        ...metadata,
        updatedAt: Date.now()
      }
    })
  }

  /**
   * Delete a session
   */
  delete(id: SessionId): Result<void> {
    try {
      logger('Deleting session:', id)
      
      // Remove session from store
      this.store.removeSession(id)
      
      logger('Session deleted:', id)
      return ok(undefined)
    } catch (error) {
      logger('Failed to delete session:', error)
      return err(error instanceof Error ? error : new Error('Failed to delete session'))
    }
  }

  /**
   * List all sessions
   */
  list(): Result<Session[]> {
    try {
      const sessionIds = this.store.getSessionIds()
      const sessions: Session[] = []

      for (const id of sessionIds) {
        const state = this.store.getState(id)
        if (state !== undefined) {
          sessions.push({
            id,
            state,
            createdAt: state.metadata.createdAt,
            updatedAt: state.metadata.updatedAt
          })
        }
      }

      return ok(sessions)
    } catch (error) {
      logger('Failed to list sessions:', error)
      return err(error instanceof Error ? error : new Error('Failed to list sessions'))
    }
  }

  /**
   * Subscribe to session changes
   */
  subscribe(id: SessionId, callback: (session: Session) => void): () => void {
    return this.store.subscribe(id, (newState) => {
      const session: Session = {
        id,
        state: newState,
        createdAt: newState.metadata.createdAt,
        updatedAt: newState.metadata.updatedAt
      }
      callback(session)
    })
  }

  /**
   * Get session statistics
   */
  getStats(): { totalSessions: number; activeSessions: number } {
    const sessions = this.list()
    if (sessions.ok) {
      const activeSessions = sessions.value.filter(
        s => s.state.auth.status === 'authenticated' &&
             s.state.connection.status === 'connected'
      ).length

      return {
        totalSessions: sessions.value.length,
        activeSessions
      }
    } else {
      return { totalSessions: 0, activeSessions: 0 }
    }
  }


  /**
   * Clean up all sessions
   */
  cleanup(): void {
    logger('Cleaning up all sessions')
    this.store.clear()
  }
}
