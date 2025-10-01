import type { ConnectionId, SessionId } from '../../types/branded.js'
import type { StructuredLogger } from '../../logging/structured-logger.js'
import type { StructuredLogInput } from '../../logging/structured-log.js'
import type { LogLevel } from '../../logging/levels.js'
import type { LogEventName } from '../../logging/event-catalog.js'
import type { LogContext, LogStatus, LogSubsystem } from '../../logging/log-context.js'
import type { Logger, SSHConfig, SSHConnection } from '../interfaces.js'

type StructuredLogResult = ReturnType<StructuredLogger['info']>
type StructuredLogFn = (entry: Omit<StructuredLogInput, 'level'>) => StructuredLogResult

export interface ConnectionLogBase {
  readonly sessionId: SessionId
  readonly host: string
  readonly port: number
  readonly username?: string | undefined
}

export interface ConnectionLogDetails {
  readonly connectionId?: ConnectionId
  readonly status?: LogStatus
  readonly reason?: string | undefined
  readonly errorCode?: string | number | undefined
  readonly durationMs?: number
  readonly bytesIn?: number
  readonly bytesOut?: number
  readonly subsystem?: LogSubsystem
  readonly data?: Record<string, unknown>
}

export interface ConnectionLoggerDeps {
  readonly structuredLogger: StructuredLogger
  readonly fallbackLogger: Logger
}

export interface ConnectionLogger {
  readonly log: (
    base: ConnectionLogBase,
    level: LogLevel,
    event: LogEventName,
    message: string,
    details?: ConnectionLogDetails
  ) => void
  readonly baseFromConfig: (config: SSHConfig) => ConnectionLogBase
  readonly baseFromConnection: (connection: SSHConnection) => ConnectionLogBase
}

function mapConfigToConnectionBase(config: SSHConfig): ConnectionLogBase {
  return {
    sessionId: config.sessionId,
    host: config.host,
    port: config.port,
    username: config.username
  }
}

function mapConnectionToBase(connection: SSHConnection): ConnectionLogBase {
  return {
    sessionId: connection.sessionId,
    host: connection.host,
    port: connection.port,
    username: connection.username
  }
}

export function createConnectionLogger(deps: ConnectionLoggerDeps): ConnectionLogger {
  const log = (
    base: ConnectionLogBase,
    level: LogLevel,
    event: LogEventName,
    message: string,
    details: ConnectionLogDetails = {}
  ): void => {
    const context = buildLogContext(base, details)
    const entry = buildLogEntry(event, message, context, details)
    emitLogWithFallback(deps, level, entry)
  }

  return {
    log,
    baseFromConfig: mapConfigToConnectionBase,
    baseFromConnection: mapConnectionToBase
  }
}

function buildLogContext(base: ConnectionLogBase, details: ConnectionLogDetails): LogContext {
  return {
    sessionId: base.sessionId,
    protocol: 'ssh',
    subsystem: details.subsystem ?? 'shell',
    targetHost: base.host,
    targetPort: base.port,
    ...(isNonEmpty(base.username) ? { username: base.username } : {}),
    ...(details.connectionId === undefined ? {} : { connectionId: details.connectionId }),
    ...(details.status === undefined ? {} : { status: details.status }),
    ...(details.reason === undefined ? {} : { reason: details.reason }),
    ...(details.errorCode === undefined ? {} : { errorCode: details.errorCode }),
    ...(details.durationMs === undefined ? {} : { durationMs: details.durationMs }),
    ...(details.bytesIn === undefined ? {} : { bytesIn: details.bytesIn }),
    ...(details.bytesOut === undefined ? {} : { bytesOut: details.bytesOut })
  }
}

function buildLogEntry(
  event: LogEventName,
  message: string,
  context: LogContext,
  details: ConnectionLogDetails
): Omit<StructuredLogInput, 'level'> {
  return {
    event,
    message,
    context,
    ...(details.data === undefined ? {} : { data: { ...details.data } })
  }
}

function emitLogWithFallback(
  deps: ConnectionLoggerDeps,
  level: LogLevel,
  entry: Omit<StructuredLogInput, 'level'>
): void {
  const emitter = selectEmitter(deps.structuredLogger, level)
  const result = emitter(entry)
  if (!result.ok) {
    const reason = result.error instanceof Error ? result.error.message : String(result.error)
    deps.fallbackLogger.warn('Failed to emit structured SSH log', { error: reason })
  }
}

function selectEmitter(structuredLogger: StructuredLogger, level: LogLevel): StructuredLogFn {
  switch (level) {
    case 'debug':
      return structuredLogger.debug
    case 'info':
      return structuredLogger.info
    case 'warn':
      return structuredLogger.warn
    case 'error':
      return structuredLogger.error
    default:
      return structuredLogger.info
  }
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value !== ''
}
