// server
// app/logger.ts

import createDebug, { type Debugger } from 'debug'
import {
  createStructuredLogger,
  type StructuredLogger,
  type StructuredLoggerOptions
} from './logging/structured-logger.js'
import type { LogContext } from './logging/log-context.js'

const defaultStructuredLogger = createStructuredLogger({
  namespace: 'webssh2:app',
  minimumLevel: 'info'
})

export function createNamespacedDebug(namespace: string): Debugger {
  return createDebug(`webssh2:${namespace}`)
}

export function createAppStructuredLogger(
  options: StructuredLoggerOptions = {}
): StructuredLogger {
  return createStructuredLogger({
    namespace: options.namespace ?? 'webssh2:app',
    ...(options.minimumLevel === undefined ? {} : { minimumLevel: options.minimumLevel }),
    ...(options.transport === undefined ? {} : { transport: options.transport }),
    ...(options.clock === undefined ? {} : { clock: options.clock })
  })
}

export function logError(message: string, error?: Error, context?: Partial<LogContext>): void {
  const structuredContext: LogContext = {
    status: 'failure',
    ...context
  }

  const structuredResult = defaultStructuredLogger.error({
    event: 'error',
    message,
    context: structuredContext,
    ...(error === undefined ? {} : { error })
  })

  if (!structuredResult.ok) {
    console.error('Failed to emit structured error log:', structuredResult.error)
  }

  console.error(message)
  if (error != null) {
    console.error(`ERROR: ${String(error)}`)
  }
}

export { createStructuredLogger, type StructuredLogger, type StructuredLoggerOptions } from './logging/structured-logger.js'

