// app/logging/structured-logger.ts
// High-level structured logger used by application code

import { formatStructuredLog, type FormatStructuredLogOptions } from './formatter.js'
import type { StructuredLogInput } from './structured-log.js'
import type { LogLevel } from './levels.js'
import { shouldLog } from './levels.js'
import type { Result } from '../types/result.js'
import { err, ok } from '../utils/result.js'
import { createStdoutTransport, type LogTransport } from './stdout-transport.js'

export interface StructuredLoggerOptions {
  readonly minimumLevel?: LogLevel
  readonly namespace?: string
  readonly transport?: LogTransport
  readonly clock?: () => Date
}

export interface StructuredLogger {
  log(entry: StructuredLogInput): Result<void>
  debug(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  info(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  warn(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  error(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  flush(): Result<void>
}

const DEFAULT_MINIMUM_LEVEL: LogLevel = 'info'

export function createStructuredLogger(options: StructuredLoggerOptions = {}): StructuredLogger {
  const minimumLevel = options.minimumLevel ?? DEFAULT_MINIMUM_LEVEL
  const transport = options.transport ?? createStdoutTransport()

  const log = (entry: StructuredLogInput): Result<void> => {
    if (!shouldLog(entry.level, minimumLevel)) {
      return ok(undefined)
    }

    const formatOptions: FormatStructuredLogOptions = {
      ...(options.clock !== undefined ? { clock: options.clock } : {}),
      ...(options.namespace !== undefined ? { namespace: options.namespace } : {})
    }

    const formatted = formatStructuredLog(entry, formatOptions)

    if (!formatted.ok) {
      return err(formatted.error)
    }

    return transport.publish(formatted.value)
  }

  const flush = (): Result<void> => transport.flush()

  return {
    log,
    debug: (entry) => log({ ...entry, level: 'debug' }),
    info: (entry) => log({ ...entry, level: 'info' }),
    warn: (entry) => log({ ...entry, level: 'warn' }),
    error: (entry) => log({ ...entry, level: 'error' }),
    flush
  }
}
