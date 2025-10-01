// server
// app/logger.ts

import createDebug, { type Debugger } from 'debug'
import {
  createStructuredLogger,
  type StructuredLoggerOptions
} from './logging/structured-logger.js'
import type { StructuredLogger } from './logging/structured-logger.js'
import type { LogContext } from './logging/log-context.js'
import type { Config, LoggingConfig } from './types/config.js'

let defaultStructuredLogger = createStructuredLogger({
  namespace: 'webssh2:app',
  minimumLevel: 'info'
})

export interface AppStructuredLoggerOptions extends StructuredLoggerOptions {
  readonly config?: Config
}

export function createNamespacedDebug(namespace: string): Debugger {
  return createDebug(`webssh2:${namespace}`)
}

export function createAppStructuredLogger(
  options: AppStructuredLoggerOptions = {}
): StructuredLogger {
  const { config, ...rest } = options
  const loggingConfig = config?.logging

  const namespace =
    rest.namespace ?? loggingConfig?.namespace ?? 'webssh2:app'
  const minimumLevel = rest.minimumLevel ?? loggingConfig?.minimumLevel
  const controls = rest.controls ?? loggingConfig?.controls

  return createStructuredLogger({
    ...rest,
    namespace,
    ...(minimumLevel === undefined ? {} : { minimumLevel }),
    ...(controls === undefined ? {} : { controls })
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

export function applyLoggingConfiguration(logging?: LoggingConfig): void {
  defaultStructuredLogger = createStructuredLogger({
    namespace: logging?.namespace ?? 'webssh2:app',
    minimumLevel: logging?.minimumLevel ?? 'info',
    ...(logging?.controls === undefined ? {} : { controls: logging.controls })
  })
}

export { createStructuredLogger } from './logging/structured-logger.js'
export type {
  StructuredLogger,
  StructuredLoggerOptions,
  StructuredLoggerMetrics
} from './logging/structured-logger.js'
