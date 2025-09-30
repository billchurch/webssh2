// app/logging/formatter.ts
// Format structured logging events into JSON strings

import { isLogEventName } from './event-catalog.js'
import type { LogContext } from './log-context.js'
import type { StructuredLogInput, StructuredLogRecord } from './structured-log.js'
import type { Result } from '../types/result.js'
import { err, ok } from '../utils/result.js'
import { safeEntries, safeGet, safeSet, createSafeKey } from '../utils/safe-property-access.js'

export interface FormatStructuredLogOptions {
  readonly clock?: () => Date
  readonly namespace?: string
}

const CONTEXT_FIELD_MAP: Record<keyof LogContext, keyof StructuredLogRecord> = {
  sessionId: 'session_id',
  requestId: 'request_id',
  username: 'username',
  authMethod: 'auth_method',
  mfaUsed: 'mfa_used',
  clientIp: 'client_ip',
  clientPort: 'client_port',
  targetHost: 'target_host',
  targetPort: 'target_port',
  protocol: 'protocol',
  subsystem: 'subsystem',
  status: 'status',
  reason: 'reason',
  errorCode: 'error_code',
  durationMs: 'duration_ms',
  bytesIn: 'bytes_in',
  bytesOut: 'bytes_out',
  auditId: 'audit_id',
  retentionTag: 'retention_tag',
  connectionId: 'connection_id'
}

const MAX_REASON_LENGTH = 512
const AUTH_METHODS = new Set([
  'publickey',
  'password',
  'keyboard-interactive',
  'agent',
  'gssapi'
])
const PROTOCOLS = new Set(['ssh', 'sftp', 'scp'])
const SUBSYSTEMS = new Set(['shell', 'sftp', 'scp', 'exec'])
const STATUSES = new Set(['success', 'failure'])
const CONTEXT_FIELD_KEY_SET = new Set(Object.keys(CONTEXT_FIELD_MAP))
const CONTEXT_VALIDATORS = createContextValidators()

export function formatStructuredLog(
  input: StructuredLogInput,
  options: FormatStructuredLogOptions = {}
): Result<string> {
  if (!isLogEventName(input.event)) {
    return err(new Error(`Unknown log event: ${input.event}`))
  }

  const recordResult = buildStructuredRecord(input, options)
  if (!recordResult.ok) {
    return recordResult
  }

  try {
    const json = JSON.stringify(recordResult.value)
    return ok(json)
  } catch (error) {
    const failure =
      error instanceof Error ? error : new Error('Failed to serialise structured log record')
    return err(failure)
  }
}

function buildStructuredRecord(
  input: StructuredLogInput,
  options: FormatStructuredLogOptions
): Result<StructuredLogRecord> {
  const skeletonResult = createRecordSkeleton(input, options)
  if (!skeletonResult.ok) {
    return skeletonResult
  }

  const record = skeletonResult.value
  addExtraSection(record, input, options)
  addDetailsSection(record, input)
  addErrorSection(record, input)

  if (input.context !== undefined) {
    const contextResult = applyContext(record, input.context)
    if (!contextResult.ok) {
      return err(contextResult.error)
    }
  }

  return ok(record as unknown as StructuredLogRecord)
}

function createRecordSkeleton(
  input: StructuredLogInput,
  options: FormatStructuredLogOptions
): Result<Record<string, unknown>> {
  const clock = options.clock ?? (() => new Date())
  const now = clock()
  if (Number.isNaN(now.getTime())) {
    return err(new Error('Clock produced invalid date'))
  }

  const record: Record<string, unknown> = {
    ts: now.toISOString(),
    level: input.level,
    event: input.event
  }

  if (input.message !== undefined) {
    safeSet(record, createSafeKey('message'), input.message)
  }

  return ok(record)
}

function addExtraSection(
  record: Record<string, unknown>,
  input: StructuredLogInput,
  options: FormatStructuredLogOptions
): void {
  const extra: Record<string, unknown> = {}

  if (options.namespace !== undefined) {
    extra['logger_namespace'] = options.namespace
  }

  if (input.extra !== undefined) {
    Object.assign(extra, clonePlainObject(input.extra))
  }

  if (Object.keys(extra).length > 0) {
    safeSet(record, createSafeKey('extra'), extra)
  }
}

function addDetailsSection(
  record: Record<string, unknown>,
  input: StructuredLogInput
): void {
  if (input.data === undefined) {
    return
  }

  if (Object.keys(input.data).length === 0) {
    return
  }

  safeSet(record, createSafeKey('details'), clonePlainObject(input.data))
}

function addErrorSection(
  record: Record<string, unknown>,
  input: StructuredLogInput
): void {
  if (input.error === undefined) {
    return
  }

  safeSet(record, createSafeKey('error_details'), serialiseError(input.error))
}

function applyContext(
  record: Record<string, unknown>,
  context: LogContext
): Result<Record<string, unknown>> {
  const contextEntries = safeEntries(context as Record<string, unknown>)

  for (const [safeKey, rawValue] of contextEntries) {
    if (rawValue === undefined) {
      continue
    }

    const keyString = safeKey as string
    if (!CONTEXT_FIELD_KEY_SET.has(keyString)) {
      continue
    }

    const field = safeGet(
      CONTEXT_FIELD_MAP as Record<string, keyof StructuredLogRecord>,
      safeKey
    ) as keyof StructuredLogRecord

    const typedKey = keyString as keyof LogContext
    if (!validateContextValue(typedKey, rawValue)) {
      return err(new Error(`Invalid value provided for context field ${keyString}`))
    }

    assignContextValue(record, field, rawValue)
  }

  return ok(record)
}

function assignContextValue(
  record: Record<string, unknown>,
  field: keyof StructuredLogRecord,
  value: unknown
): void {
  if (field === 'duration_ms' || field === 'bytes_in' || field === 'bytes_out') {
    safeSet(
      record,
      createSafeKey(field),
      Number.parseFloat(String(value))
    )
    return
  }

  safeSet(record, createSafeKey(field), value)
}

function validateContextValue(key: keyof LogContext, value: unknown): boolean {
  const validator = CONTEXT_VALIDATORS.get(key)
  if (validator === undefined) {
    return false
  }
  return validator(value)
}

function createContextValidators(): ReadonlyMap<keyof LogContext, (value: unknown) => boolean> {
  const validators = new Map<keyof LogContext, (value: unknown) => boolean>()

  const nonEmptyStringKeys: Array<keyof LogContext> = [
    'sessionId',
    'requestId',
    'username',
    'clientIp',
    'targetHost',
    'auditId',
    'retentionTag',
    'connectionId'
  ]

  nonEmptyStringKeys.forEach((key) => {
    validators.set(key, isNonEmptyString)
  })

  validators.set('clientPort', isValidPort)
  validators.set('targetPort', isValidPort)
  validators.set('durationMs', isNonNegativeNumber)
  validators.set('bytesIn', isNonNegativeNumber)
  validators.set('bytesOut', isNonNegativeNumber)
  validators.set('mfaUsed', (value) => typeof value === 'boolean')
  validators.set('errorCode', isValidErrorCode)
  validators.set('authMethod', (value) => typeof value === 'string' && AUTH_METHODS.has(value))
  validators.set('protocol', (value) => typeof value === 'string' && PROTOCOLS.has(value))
  validators.set('subsystem', (value) => typeof value === 'string' && SUBSYSTEMS.has(value))
  validators.set('status', (value) => typeof value === 'string' && STATUSES.has(value))
  validators.set('reason', isValidReason)

  return validators
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0
}

function isValidPort(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 65535
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isValidErrorCode(value: unknown): boolean {
  return (typeof value === 'string' && value !== '') || typeof value === 'number'
}

function isValidReason(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_REASON_LENGTH
}

function serialiseError(error: Error): Record<string, unknown> {
  const serialised: Record<string, unknown> = {}
  safeSet(serialised, createSafeKey('message'), error.message)
  safeSet(serialised, createSafeKey('name'), error.name)

  if (error.stack !== undefined) {
    safeSet(
      serialised,
      createSafeKey('stack'),
      error.stack.split('\n').map((line) => line.trim())
    )
  }

  return serialised
}

function clonePlainObject(source: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source))
}
