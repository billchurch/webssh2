import type { Client } from 'ssh2'
import type { SSHConfig, SSHConnection } from '../interfaces.js'
import type { ConnectionPool } from './connection-pool.js'
import type { SessionStore } from '../../state/store.js'
import type { LogStatus } from '../../logging/log-context.js'
import type { ConnectionLogger } from './connection-logger.js'
import type { AlgorithmCapture, CapturedAlgorithms } from './algorithm-capture.js'
import { normalizeSSHErrorMessage } from './error-normalizer.js'

type DebugLogger = (message?: unknown, ...params: unknown[]) => void

/**
 * Extended error type that includes captured algorithm information
 */
export interface SSHConnectionError extends Error {
  capturedAlgorithms?: CapturedAlgorithms
}

export interface ConnectionHandlerDependencies {
  readonly pool: ConnectionPool
  readonly store: SessionStore
  readonly connectionLogger: ConnectionLogger
  readonly debug: DebugLogger
  readonly algorithmCapture?: AlgorithmCapture | null
}

export interface RegisterConnectionHandlersInput {
  readonly client: Client
  readonly connection: SSHConnection
  readonly config: SSHConfig
  readonly timeout: ReturnType<typeof setTimeout>
  readonly onReady: () => void
  readonly onError: (error: Error) => void
}

export function registerConnectionHandlers(
  deps: ConnectionHandlerDependencies,
  input: RegisterConnectionHandlersInput
): void {
  input.client.on('ready', createReadyHandler(deps, input))
  input.client.on('error', createErrorHandler(deps, input))
  input.client.on('close', createCloseHandler(deps, input))
}

function createReadyHandler(
  deps: ConnectionHandlerDependencies,
  input: RegisterConnectionHandlersInput
): () => void {
  return () => {
    clearTimeout(input.timeout)
    deps.debug('SSH connection ready')

    input.connection.status = 'connected'
    input.connection.lastActivity = Date.now()
    deps.pool.add(input.connection)

    deps.store.dispatch(input.config.sessionId, {
      type: 'CONNECTION_ESTABLISHED',
      payload: { connectionId: input.connection.id }
    })

    deps.connectionLogger.log(
      deps.connectionLogger.baseFromConnection(input.connection),
      'info',
      'session_start',
      'SSH connection established',
      {
        connectionId: input.connection.id,
        status: 'success',
        durationMs: Date.now() - input.connection.createdAt
      }
    )

    input.onReady()
  }
}

function createErrorHandler(
  deps: ConnectionHandlerDependencies,
  input: RegisterConnectionHandlersInput
): (error: Error & { level?: string }) => void {
  return (error) => {
    clearTimeout(input.timeout)
    const errorMessage = normalizeSSHErrorMessage(error)
    deps.debug('SSH connection error:', errorMessage)
    deps.debug('SSH error details:', {
      message: errorMessage,
      level: error.level,
      stack: error.stack
    })

    input.connection.status = 'error'

    deps.store.dispatch(input.config.sessionId, {
      type: 'CONNECTION_ERROR',
      payload: { error: errorMessage }
    })

    deps.connectionLogger.log(
      deps.connectionLogger.baseFromConnection(input.connection),
      'error',
      'error',
      'SSH connection error',
      {
        connectionId: input.connection.id,
        status: 'failure',
        reason: errorMessage,
        errorCode: error.level
      }
    )

    // Attach captured algorithms to the error for debug error pages
    const extendedError: SSHConnectionError = error
    if (deps.algorithmCapture?.hasData() === true) {
      extendedError.capturedAlgorithms = deps.algorithmCapture.getAlgorithms()
      deps.debug('Attached captured algorithms to error:', extendedError.capturedAlgorithms)
    }

    input.onError(extendedError)
  }
}

function createCloseHandler(
  deps: ConnectionHandlerDependencies,
  input: RegisterConnectionHandlersInput
): () => void {
  return () => {
    deps.debug('SSH connection closed')
    deps.pool.remove(input.connection.id)

    deps.store.dispatch(input.config.sessionId, {
      type: 'CONNECTION_CLOSED',
      payload: {}
    })

    const status: LogStatus = input.connection.status === 'error' ? 'failure' : 'success'
    deps.connectionLogger.log(
      deps.connectionLogger.baseFromConnection(input.connection),
      'info',
      'session_end',
      'SSH connection closed',
      {
        connectionId: input.connection.id,
        status,
        durationMs: Date.now() - input.connection.createdAt
      }
    )
  }
}
