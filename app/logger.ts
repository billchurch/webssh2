// server
// app/logger.ts

import createDebug, { type Debugger } from 'debug'
import {
  createStructuredLogger,
  type StructuredLoggerOptions,
  type StructuredLogger
} from './logging/structured-logger.js'
import { createStdoutTransport, type LogTransport } from './logging/stdout-transport.js'
import { createCompositeTransport, createNoopTransport } from './logging/composite-transport.js'
import { createLevelFilteredTransport } from './logging/transport-filters.js'
import { createSyslogTransport } from './logging/syslog-transport.js'
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
  const {
    config,
    transport: customTransport,
    namespace: explicitNamespace,
    minimumLevel: explicitMinimumLevel,
    controls: explicitControls,
    ...rest
  } = options

  const loggingConfig = config?.logging
  const namespace = resolveNamespace(explicitNamespace, loggingConfig)
  const minimumLevel = resolveMinimumLevel(explicitMinimumLevel, loggingConfig)
  const controls = resolveControls(explicitControls, loggingConfig)
  const transport = buildTransport({
    ...(customTransport === undefined ? {} : { customTransport }),
    ...(loggingConfig === undefined ? {} : { loggingConfig })
  })

  return createStructuredLogger({
    ...rest,
    namespace,
    ...(minimumLevel === undefined ? {} : { minimumLevel }),
    ...(controls === undefined ? {} : { controls }),
    transport
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
    ...(logging?.controls === undefined ? {} : { controls: logging.controls }),
    transport: buildTransport({
      ...(logging === undefined ? {} : { loggingConfig: logging })
    })
  })
}

export { createStructuredLogger } from './logging/structured-logger.js'
export type { StructuredLogger, StructuredLoggerOptions, StructuredLoggerMetrics } from './logging/structured-logger.js'

interface BuildTransportOptions {
  readonly loggingConfig?: LoggingConfig
  readonly customTransport?: LogTransport
}

function buildTransport(options: BuildTransportOptions): LogTransport {
  const transports: LogTransport[] = []

  if (options.customTransport !== undefined) {
    transports.push(options.customTransport)
  }

  const stdoutTransport = createStdoutTransportIfEnabled(options.loggingConfig?.stdout)
  if (stdoutTransport !== undefined) {
    transports.push(stdoutTransport)
  }

  const syslogTransport = createSyslogTransportIfEnabled(options.loggingConfig?.syslog)
  if (syslogTransport !== undefined) {
    transports.push(syslogTransport)
  }

  if (transports.length === 0) {
    return createNoopTransport()
  }

  return createCompositeTransport(transports)
}

function createStdoutTransportIfEnabled(config: LoggingConfig['stdout'] | undefined): LogTransport | undefined {
  if (config?.enabled === false) {
    return undefined
  }

  let transport: LogTransport = createStdoutTransport()
  if (config?.minimumLevel !== undefined) {
    transport = createLevelFilteredTransport(transport, config.minimumLevel)
  }
  return transport
}

function createSyslogTransportIfEnabled(
  config: LoggingConfig['syslog'] | undefined
): LogTransport | undefined {
  if (config?.enabled !== true) {
    return undefined
  }

  if (config.host === undefined || config.port === undefined) {
    process.stderr.write('Syslog transport disabled: host and port are required\n')
    return undefined
  }

  const transportResult = createSyslogTransport({
    host: config.host,
    port: config.port,
    ...(config.appName === undefined ? {} : { appName: config.appName }),
    ...(config.enterpriseId === undefined ? {} : { enterpriseId: config.enterpriseId }),
    ...(config.bufferSize === undefined ? {} : { bufferSize: config.bufferSize }),
    ...(config.flushIntervalMs === undefined ? {} : { flushIntervalMs: config.flushIntervalMs }),
    ...(config.includeJson === undefined ? {} : { includeJson: config.includeJson }),
    ...(config.tls === undefined ? {} : { tls: config.tls })
  })

  if (transportResult.ok) {
    return transportResult.value
  }

  process.stderr.write(`Syslog transport disabled: ${transportResult.error.message}\n`)
  return undefined
}

function resolveNamespace(
  explicit: StructuredLoggerOptions['namespace'],
  loggingConfig: LoggingConfig | undefined
): string {
  if (explicit !== undefined) {
    return explicit
  }
  if (loggingConfig?.namespace !== undefined) {
    return loggingConfig.namespace
  }
  return 'webssh2:app'
}

function resolveMinimumLevel(
  explicit: StructuredLoggerOptions['minimumLevel'],
  loggingConfig: LoggingConfig | undefined
): StructuredLoggerOptions['minimumLevel'] {
  return explicit ?? loggingConfig?.minimumLevel
}

function resolveControls(
  explicit: StructuredLoggerOptions['controls'],
  loggingConfig: LoggingConfig | undefined
): StructuredLoggerOptions['controls'] {
  return explicit ?? loggingConfig?.controls
}
