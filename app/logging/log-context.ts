// app/logging/log-context.ts
// Context metadata accepted by structured logging events

export type LogProtocol = 'ssh' | 'sftp' | 'scp'
export type LogSubsystem = 'shell' | 'sftp' | 'scp' | 'exec'
export type LogStatus = 'success' | 'failure'
export type LogAuthMethod =
  | 'publickey'
  | 'password'
  | 'keyboard-interactive'
  | 'agent'
  | 'gssapi'

export interface LogContext {
  readonly sessionId?: string
  readonly requestId?: string
  readonly username?: string
  readonly authMethod?: LogAuthMethod
  readonly mfaUsed?: boolean
  readonly clientIp?: string
  readonly clientPort?: number
  readonly clientSourcePort?: number
  readonly userAgent?: string
  readonly targetHost?: string
  readonly targetPort?: number
  readonly protocol?: LogProtocol
  readonly subsystem?: LogSubsystem
  readonly status?: LogStatus
  readonly reason?: string
  readonly errorCode?: string | number
  readonly durationMs?: number
  readonly bytesIn?: number
  readonly bytesOut?: number
  readonly auditId?: string
  readonly retentionTag?: string
  readonly connectionId?: string
}

export interface ExtendedLogDetails {
  readonly [key: string]: unknown
}
