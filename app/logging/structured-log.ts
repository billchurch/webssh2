// app/logging/structured-log.ts
// Data contracts for structured logging pipeline

import type { LogEventName } from './event-catalog.js'
import type { LogContext, ExtendedLogDetails } from './log-context.js'
import type { LogLevel } from './levels.js'

export interface StructuredLogInput {
  readonly level: LogLevel
  readonly event: LogEventName
  readonly message?: string
  readonly context?: LogContext
  readonly data?: Readonly<Record<string, unknown>>
  readonly error?: Error
  readonly extra?: Readonly<ExtendedLogDetails>
}

export interface StructuredLogRecord {
  readonly ts: string
  readonly level: LogLevel
  readonly event: LogEventName
  readonly message?: string
  readonly session_id?: string
  readonly request_id?: string
  readonly username?: string
  readonly auth_method?: string
  readonly mfa_used?: boolean
  readonly client_ip?: string
  readonly client_port?: number
  readonly client_source_port?: number
  readonly user_agent?: string
  readonly target_host?: string
  readonly target_port?: number
  readonly protocol?: string
  readonly subsystem?: string
  readonly status?: string
  readonly reason?: string
  readonly error_code?: string | number
  readonly duration_ms?: number
  readonly bytes_in?: number
  readonly bytes_out?: number
  readonly audit_id?: string
  readonly retention_tag?: string
  readonly connection_id?: string
  readonly details?: Record<string, unknown>
  readonly error_details?: Record<string, unknown>
  readonly extra?: Record<string, unknown>
}
