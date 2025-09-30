// app/logging/socket-logger.ts
// Utilities for emitting structured socket logging events

import type { AdapterContext } from '../socket/adapters/service-socket-shared.js'
import type { LogEventName } from './event-catalog.js'
import type { LogContext, LogStatus, LogSubsystem } from './log-context.js'
import type { LogLevel } from './levels.js'
import type { StructuredLogInput } from './structured-log.js'
import type { Result } from '../types/result.js'

export interface SocketLogOptions {
  readonly status?: LogStatus
  readonly reason?: string
  readonly errorCode?: string | number
  readonly durationMs?: number
  readonly bytesIn?: number
  readonly bytesOut?: number
  readonly subsystem?: LogSubsystem
  readonly data?: Readonly<Record<string, unknown>>
}

type StructuredLogEntry = Omit<StructuredLogInput, 'level'>

export function emitSocketLog(
  adapter: AdapterContext,
  level: LogLevel,
  event: LogEventName,
  message: string,
  options: SocketLogOptions = {}
): void {
  const context = buildSocketLogContext(adapter, options)
  const entry = buildLogEntry(event, message, context, options.data)

  const result = invokeLogger(adapter, level, entry)
  if (!result.ok) {
    adapter.debug('Failed to emit structured socket log:', result.error)
  }
}

export function buildSocketLogContext(
  adapter: AdapterContext,
  options: SocketLogOptions = {}
): LogContext {
  const context: Record<string, unknown> = {
    protocol: 'ssh',
    subsystem: options.subsystem ?? 'shell'
  }

  populateStateContext(context, adapter)
  populateStatusContext(context, options)
  populateMetricContext(context, options)

  return context as LogContext
}

function buildLogEntry(
  event: LogEventName,
  message: string,
  context: LogContext,
  data?: Readonly<Record<string, unknown>>
): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    event,
    message,
    context
  }

  if (data !== undefined && Object.keys(data).length > 0) {
    return {
      ...entry,
      data: { ...data }
    }
  }

  return entry
}

function invokeLogger(
  adapter: AdapterContext,
  level: LogLevel,
  entry: Omit<StructuredLogEntry, never>
): Result<void> {
  switch (level) {
    case 'debug':
      return adapter.logger.debug(entry)
    case 'info':
      return adapter.logger.info(entry)
    case 'warn':
      return adapter.logger.warn(entry)
    case 'error':
      return adapter.logger.error(entry)
    default: {
      return adapter.logger.info(entry)
    }
  }
}

function populateStateContext(context: Record<string, unknown>, adapter: AdapterContext): void {
  const { state, socket } = adapter

  if (state.sessionId !== null) {
    context['sessionId'] = state.sessionId
  }

  context['requestId'] = socket.id

  if (state.username !== null) {
    context['username'] = state.username
  }

  if (state.originalAuthMethod !== null) {
    context['authMethod'] = state.originalAuthMethod
  }

  if (state.clientIp !== null) {
    context['clientIp'] = state.clientIp
  }

  if (state.clientPort !== null) {
    context['clientPort'] = state.clientPort
  }

  if (state.targetHost !== null) {
    context['targetHost'] = state.targetHost
  }

  if (state.targetPort !== null) {
    context['targetPort'] = state.targetPort
  }

  if (state.connectionId !== null) {
    context['connectionId'] = state.connectionId
  }
}

function populateStatusContext(context: Record<string, unknown>, options: SocketLogOptions): void {
  if (options.status !== undefined) {
    context['status'] = options.status
  }

  if (options.reason !== undefined) {
    context['reason'] = options.reason
  }

  if (options.errorCode !== undefined) {
    context['errorCode'] = options.errorCode
  }

  if (options.subsystem !== undefined) {
    context['subsystem'] = options.subsystem
  }
}

function populateMetricContext(context: Record<string, unknown>, options: SocketLogOptions): void {
  if (options.durationMs !== undefined) {
    context['durationMs'] = options.durationMs
  }

  if (options.bytesIn !== undefined) {
    context['bytesIn'] = options.bytesIn
  }

  if (options.bytesOut !== undefined) {
    context['bytesOut'] = options.bytesOut
  }
}
