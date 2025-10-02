// app/logging/syslog-formatter.ts
// Convert structured log payloads into RFC 5424 syslog messages

import os from 'node:os'
import type { StructuredLogRecord } from './structured-log.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'
import type { LogLevel } from './levels.js'

const DEFAULT_FACILITY = 16 // local0
const DEFAULT_ENTERPRISE_ID = 32473
const STRUCTURED_DATA_ID = 'webssh2'

const SEVERITY_MAP: Record<LogLevel, number> = {
  debug: 7,
  info: 6,
  warn: 4,
  error: 3
}

const STRUCTURED_FIELDS = [
  'event',
  'session_id',
  'request_id',
  'username',
  'client_ip',
  'target_host',
  'status',
  'connection_id'
] as const

const STRUCTURED_VALUE_ESCAPES: ReadonlyArray<readonly [string, string]> = [
  [String.raw`\\`, String.raw`\\\\`],
  [String.raw`]`, String.raw`\]`],
  [String.raw`"`, String.raw`\"`]
] as const

type StructuredField = typeof STRUCTURED_FIELDS[number]

export interface SyslogFormatterOptions {
  readonly facility?: number
  readonly hostname?: string
  readonly appName?: string
  readonly procId?: string
  readonly enterpriseId?: number
  readonly includeJson?: boolean
}

export function formatSyslogMessage(
  payload: string,
  options: SyslogFormatterOptions = {}
): Result<string> {
  const parsed = parseStructuredRecord(payload)
  if (!parsed.ok) {
    return parsed
  }

  const record = parsed.value
  const facility = typeof options.facility === 'number' ? options.facility : DEFAULT_FACILITY
  const enterpriseId = typeof options.enterpriseId === 'number' ? options.enterpriseId : DEFAULT_ENTERPRISE_ID
  const severity = SEVERITY_MAP[record.level]
  const priority = facility * 8 + severity
  const timestamp = normaliseTimestamp(record.ts)
  const hostname = options.hostname ?? os.hostname()
  const appName = options.appName ?? 'webssh2'
  const procId = options.procId ?? String(process.pid)
  const msgId = record.event
  const structuredData = buildStructuredData(record, enterpriseId)
  const message = buildMessageBody(payload, record, options.includeJson === true)

  const header = `<${priority}>1 ${timestamp} ${hostname} ${appName} ${procId} ${msgId} ${structuredData}`
  return ok(`${header} ${message}`)
}

function parseStructuredRecord(payload: string): Result<StructuredLogRecord> {
  try {
    const parsed = JSON.parse(payload) as StructuredLogRecord
    return ok(parsed)
  } catch (error) {
    const failure = error instanceof Error ? error : new Error('Failed to parse structured log payload for syslog transport')
    return err(failure)
  }
}

function normaliseTimestamp(timestamp?: string): string {
  if (typeof timestamp === 'string' && timestamp !== '') {
    return timestamp
  }
  return new Date().toISOString()
}

function buildStructuredData(record: StructuredLogRecord, enterpriseId: number): string {
  const params: string[] = []

  for (const field of STRUCTURED_FIELDS) {
    const value = pickStructuredValue(record, field)
    if (value === undefined || value === null) {
      continue
    }

    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      continue
    }

    params.push(`${field}="${escapeStructuredValue(String(value))}"`)
  }

  const sdId = `${STRUCTURED_DATA_ID}@${enterpriseId}`
  if (params.length === 0) {
    return `[${sdId}]`
  }

  return `[${sdId} ${params.join(' ')}]`
}

function buildMessageBody(
  payload: string,
  record: StructuredLogRecord,
  includeJson: boolean
): string {
  if (includeJson) {
    return payload
  }

  if (typeof record.message === 'string' && record.message.trim() !== '') {
    return record.message
  }

  return '-'
}

function escapeStructuredValue(value: string): string {
  return STRUCTURED_VALUE_ESCAPES.reduce(
    (escaped, [target, replacement]) => escaped.replaceAll(target, replacement),
    value
  )
}

function pickStructuredValue(
  record: StructuredLogRecord,
  field: StructuredField
): unknown {
  switch (field) {
    case 'event':
      return record.event
    case 'session_id':
      return record.session_id
    case 'request_id':
      return record.request_id
    case 'username':
      return record.username
    case 'client_ip':
      return record.client_ip
    case 'target_host':
      return record.target_host
    case 'status':
      return record.status
    case 'connection_id':
      return record.connection_id
  }
}
