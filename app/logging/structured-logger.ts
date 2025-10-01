// app/logging/structured-logger.ts
// High-level structured logger used by application code

import { formatStructuredLog, type FormatStructuredLogOptions } from './formatter.js'
import type { StructuredLogInput } from './structured-log.js'
import { shouldLog, type LogLevel } from './levels.js'
import type { Result } from '../types/result.js'
import { err, ok } from '../utils/result.js'
import {
  createStdoutTransport,
  type LogTransport,
  TransportBackpressureError
} from './stdout-transport.js'
import type { LoggingControlsConfig } from '../types/config.js'
import {
  createLoggingControlState,
  evaluateLoggingControls,
  type LoggingControlState
} from '../services/logging/controls.js'

export interface StructuredLoggerOptions {
  readonly minimumLevel?: LogLevel
  readonly namespace?: string
  readonly transport?: LogTransport
  readonly clock?: () => Date
  readonly controls?: LoggingControlsConfig
  readonly random?: () => number
}

export interface StructuredLoggerMetrics {
  readonly published: number
  readonly droppedBySampling: number
  readonly droppedByRateLimit: number
  readonly droppedByQueue: number
  readonly lastError?: Error
}

export interface StructuredLogger {
  log(entry: StructuredLogInput): Result<void>
  debug(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  info(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  warn(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  error(entry: Omit<StructuredLogInput, 'level'>): Result<void>
  flush(): Result<void>
  updateControls(config: LoggingControlsConfig | undefined): void
  snapshotMetrics(): StructuredLoggerMetrics
}

const DEFAULT_MINIMUM_LEVEL: LogLevel = 'info'

export function createStructuredLogger(options: StructuredLoggerOptions = {}): StructuredLogger {
  const minimumLevel = options.minimumLevel ?? DEFAULT_MINIMUM_LEVEL
  const transport = options.transport ?? createStdoutTransport()
  const randomFn = options.random ?? Math.random
  let controlsConfig = options.controls
  let controlState: LoggingControlState = createLoggingControlState()
  let queueDropCount = 0
  let lastPublishError: Error | undefined

  const baseClock = options.clock ?? (() => new Date())

  const log = (entry: StructuredLogInput): Result<void> => {
    if (shouldLog(entry.level, minimumLevel) === false) {
      return ok(undefined)
    }

    const preparation = prepareLogEntry({
      entry,
      controls: controlsConfig,
      state: controlState,
      random: randomFn,
      clock: baseClock,
      ...(options.namespace === undefined ? {} : { namespace: options.namespace })
    })

    if (preparation.ok === false) {
      return err(preparation.error)
    }

    const prepared = preparation.value
    controlState = prepared.state

    if (prepared.skip === true || prepared.payload === undefined) {
      return ok(undefined)
    }

    const publishResult = transport.publish(prepared.payload)
    if (publishResult.ok === false) {
      if (publishResult.error instanceof TransportBackpressureError) {
        queueDropCount += 1
        controlState = rollbackPublished(controlState)
        lastPublishError = publishResult.error
        return ok(undefined)
      }
      lastPublishError = publishResult.error
      return err(publishResult.error)
    }

    lastPublishError = undefined
    return ok(undefined)
  }

  const flush = (): Result<void> => transport.flush()

  const updateControls = (config: LoggingControlsConfig | undefined): void => {
    controlsConfig = config
    controlState = createLoggingControlState()
  }

  const snapshotMetrics = (): StructuredLoggerMetrics => ({
    published: controlState.metrics.published,
    droppedBySampling: controlState.metrics.droppedBySampling,
    droppedByRateLimit: controlState.metrics.droppedByRateLimit,
    droppedByQueue: queueDropCount,
    ...(lastPublishError === undefined ? {} : { lastError: lastPublishError })
  })

  return {
    log,
    debug: (entry) => log({ ...entry, level: 'debug' }),
    info: (entry) => log({ ...entry, level: 'info' }),
    warn: (entry) => log({ ...entry, level: 'warn' }),
    error: (entry) => log({ ...entry, level: 'error' }),
    flush,
    updateControls,
    snapshotMetrics
  }
}

function rollbackPublished(state: LoggingControlState): LoggingControlState {
  const metrics = state.metrics
  const published = metrics.published > 0 ? metrics.published - 1 : 0

  return {
    rateLimitBuckets: state.rateLimitBuckets,
    metrics: {
      published,
      droppedBySampling: metrics.droppedBySampling,
      droppedByRateLimit: metrics.droppedByRateLimit
    }
  }
}

interface PreparedLogEntry {
  readonly skip: boolean
  readonly payload?: string
  readonly state: LoggingControlState
}

interface PrepareLogEntryOptions {
  readonly entry: StructuredLogInput
  readonly controls: LoggingControlsConfig | undefined
  readonly state: LoggingControlState
  readonly random: () => number
  readonly clock: () => Date
  readonly namespace?: string
}

function prepareLogEntry(options: PrepareLogEntryOptions): Result<PreparedLogEntry> {
  const now = options.clock()
  const timestamp = now.getTime()
  if (Number.isNaN(timestamp)) {
    return err(new Error('Clock produced invalid date'))
  }

  const decision = evaluateLoggingControls({
    event: options.entry.event,
    nowMs: timestamp,
    ...(options.controls === undefined ? {} : { config: options.controls }),
    state: options.state,
    random: options.random
  })

  const updatedState = decision.updatedState
  if (decision.allow === false) {
    return ok({ skip: true, state: updatedState })
  }

  const formatOptions: FormatStructuredLogOptions = {
    clock: () => now,
    ...(options.namespace === undefined ? {} : { namespace: options.namespace })
  }

  const formatted = formatStructuredLog(options.entry, formatOptions)
  if (formatted.ok === false) {
    return err(formatted.error)
  }

  return ok({ skip: false, payload: formatted.value, state: updatedState })
}
