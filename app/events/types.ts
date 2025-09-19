/**
 * Event type definitions for the application event bus
 */

import type { SessionId, ConnectionId, UserId } from '../types/branded.js'

/**
 * Authentication related events
 */
export type AuthEvent =
  | {
      type: 'auth.request'
      payload: {
        sessionId: SessionId
        method: 'basic' | 'manual' | 'post' | 'keyboard-interactive' | 'key' | 'password'
        username: string
        password?: string
        privateKey?: string
        passphrase?: string
        host?: string
        port?: number
      }
    }
  | {
      type: 'auth.success'
      payload: {
        sessionId: SessionId
        userId: UserId
        username: string
        method: 'basic' | 'manual' | 'post' | 'keyboard-interactive' | 'key' | 'password'
      }
    }
  | {
      type: 'auth.failure'
      payload: {
        sessionId: SessionId
        reason: string
        method: 'basic' | 'manual' | 'post' | 'keyboard-interactive' | 'key' | 'password'
      }
    }
  | {
      type: 'auth.logout'
      payload: {
        sessionId: SessionId
        userId?: UserId
      }
    }
  | {
      type: 'auth.clear'
      payload: {
        sessionId: SessionId
      }
    }

/**
 * SSH connection related events
 */
export type ConnectionEvent =
  | {
      type: 'connection.request'
      payload: {
        sessionId: SessionId
        host: string
        port: number
        username?: string
        password?: string
        privateKey?: string
      }
    }
  | {
      type: 'connection.established'
      payload: {
        sessionId: SessionId
        connectionId: ConnectionId
        host: string
        port: number
      }
    }
  | {
      type: 'connection.ready'
      payload: {
        sessionId: SessionId
        connectionId: ConnectionId
      }
    }
  | {
      type: 'connection.error'
      payload: {
        sessionId: SessionId
        connectionId?: ConnectionId
        error: string
        code?: string
      }
    }
  | {
      type: 'connection.closed'
      payload: {
        sessionId: SessionId
        connectionId?: ConnectionId
        reason: string
        hadError?: boolean
      }
    }
  | {
      type: 'connection.timeout'
      payload: {
        sessionId: SessionId
        connectionId?: ConnectionId
      }
    }

/**
 * Terminal I/O related events
 */
export type TerminalEvent =
  | {
      type: 'terminal.create'
      payload: {
        sessionId: SessionId
        term: string
        rows: number
        cols: number
        cwd: string | null
        env: Record<string, string>
      }
    }
  | {
      type: 'terminal.ready'
      payload: {
        sessionId: SessionId
        stream?: unknown // SSH2Stream
      }
    }
  | {
      type: 'terminal.error'
      payload: {
        sessionId: SessionId
        error: string
      }
    }
  | {
      type: 'terminal.input'
      payload: {
        sessionId: SessionId
        data: string
      }
    }
  | {
      type: 'terminal.output'
      payload: {
        sessionId: SessionId
        data: string
      }
    }
  | {
      type: 'terminal.data.in'
      payload: {
        sessionId: SessionId
        data: string | Buffer
      }
    }
  | {
      type: 'terminal.data.out'
      payload: {
        sessionId: SessionId
        data: string | Buffer
      }
    }
  | {
      type: 'terminal.resize'
      payload: {
        sessionId: SessionId
        rows: number
        cols: number
        height?: number
        width?: number
      }
    }
  | {
      type: 'terminal.command'
      payload: {
        sessionId: SessionId
        command: string
        pty?: boolean
        env?: Record<string, string>
      }
    }
  | {
      type: 'terminal.exec.start'
      payload: {
        sessionId: SessionId
        command: string
        execId: string
      }
    }
  | {
      type: 'terminal.exec.data'
      payload: {
        sessionId: SessionId
        execId: string
        type: 'stdout' | 'stderr'
        data: string
      }
    }
  | {
      type: 'terminal.exec.exit'
      payload: {
        sessionId: SessionId
        execId: string
        code: number | null
        signal: string | null
      }
    }

/**
 * Exec-specific events
 */
export type ExecEvent =
  | {
      type: 'exec.request'
      payload: {
        sessionId: SessionId
        command: string
      }
    }
  | {
      type: 'exec.result'
      payload: {
        sessionId: SessionId
        stdout: string
        stderr: string
        code: number
      }
    }

/**
 * Session lifecycle events
 */
export type SessionEvent =
  | {
      type: 'session.created'
      payload: {
        sessionId: SessionId
        clientIp?: string
        userAgent?: string
      }
    }
  | {
      type: 'session.updated'
      payload: {
        sessionId: SessionId
        updates: Record<string, unknown>
      }
    }
  | {
      type: 'session.destroyed'
      payload: {
        sessionId: SessionId
        reason: string
      }
    }
  | {
      type: 'session.timeout'
      payload: {
        sessionId: SessionId
      }
    }

/**
 * System level events for monitoring and debugging
 */
export type SystemEvent =
  | {
      type: 'system.error'
      payload: {
        error: Error | string
        context: string
        sessionId?: SessionId
        connectionId?: ConnectionId
      }
    }
  | {
      type: 'system.warning'
      payload: {
        message: string
        details?: unknown
        sessionId?: SessionId
      }
    }
  | {
      type: 'system.info'
      payload: {
        message: string
        details?: unknown
      }
    }
  | {
      type: 'system.metrics'
      payload: {
        metric: string
        value: number
        tags?: Record<string, string>
      }
    }
  | {
      type: 'system.health'
      payload: {
        status: 'healthy' | 'degraded' | 'unhealthy'
        checks: Record<string, boolean>
      }
    }

/**
 * Recording/replay events
 */
export type RecordingEvent =
  | {
      type: 'recording.start'
      payload: {
        sessionId: SessionId
        recordingId: string
      }
    }
  | {
      type: 'recording.data'
      payload: {
        sessionId: SessionId
        recordingId: string
        timestamp: number
        data: string
      }
    }
  | {
      type: 'recording.stop'
      payload: {
        sessionId: SessionId
        recordingId: string
      }
    }
  | {
      type: 'replay.start'
      payload: {
        sessionId: SessionId
        recordingId: string
      }
    }
  | {
      type: 'replay.progress'
      payload: {
        sessionId: SessionId
        recordingId: string
        position: number
        total: number
      }
    }
  | {
      type: 'replay.stop'
      payload: {
        sessionId: SessionId
        recordingId: string
      }
    }

/**
 * Combined application event type
 */
export type AppEvent =
  | AuthEvent
  | ConnectionEvent
  | TerminalEvent
  | ExecEvent
  | SessionEvent
  | SystemEvent
  | RecordingEvent

/**
 * Event type helper to extract event types
 */
export type EventType = AppEvent['type']

/**
 * Helper to extract payload type for a specific event
 */
export type EventPayload<T extends EventType> = Extract<AppEvent, { type: T }>['payload']

/**
 * Type guard to check if event is of specific type
 */
export function isEventType<T extends EventType>(
  event: AppEvent,
  type: T
): event is Extract<AppEvent, { type: T }> {
  return event.type === type
}

/**
 * Priority levels for event processing
 */
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Event with metadata for processing
 */
export interface EventWithMetadata {
  event: AppEvent
  priority: EventPriority
  timestamp: number
  id: string
  retryCount?: number
}