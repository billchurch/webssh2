/**
 * Boundary helpers for inbound Socket.IO events: payload validation, error
 * containment and credential-safe debug output.
 */

import type { Result } from '../../types/result.js'
import type { AdapterContext } from './service-socket-shared.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import { emitSocketLog } from '../../logging/socket-logger.js'
import { maskSensitive } from '../../utils/data-masker.js'
import { createSafeKey, safeGet } from '../../utils/safe-property-access.js'

interface ListenerTarget {
  on(event: string, listener: (...args: unknown[]) => void): unknown
}

type PayloadValidator<T> = (payload: unknown) => Result<T>
type PayloadHandler<T> = (payload: T) => void | Promise<void>
type InvalidPayloadReply = (error: Error) => void

const HANDLER_FAILURE_MESSAGE = 'Request failed'

/** Accepts any payload; for handlers that validate internally (SFTP, prompts) */
export const acceptPayload: PayloadValidator<unknown> = (payload) => ({ ok: true, value: payload })

/** Accepts no payload; for events whose arguments are ignored */
export const ignorePayload: PayloadValidator<undefined> = () => ({ ok: true, value: undefined })

// Validator and handler messages may embed client-controlled text; cap what
// reaches logs and replies regardless of where the message came from
const MAX_REASON_LENGTH = 200

function boundReason(reason: string): string {
  return reason.length > MAX_REASON_LENGTH ? `${reason.slice(0, MAX_REASON_LENGTH)}…` : reason
}

function errorMessage(error: unknown): string {
  return boundReason(error instanceof Error ? error.message : String(error))
}

function reportInvalidPayload(
  context: AdapterContext,
  event: string,
  error: Error,
  reply: InvalidPayloadReply | undefined
): void {
  const reason = boundReason(error.message)
  context.debug(`Rejected '${event}' payload: ${reason}`)
  emitSocketLog(context, 'warn', 'socket_payload_invalid', 'Rejected invalid socket event payload', {
    status: 'failure',
    reason,
    data: { socket_event: event }
  })

  if (reply === undefined) {
    context.socket.emit(SOCKET_EVENTS.SSH_ERROR, `Invalid ${event} payload: ${reason}`)
    return
  }
  reply(new Error(reason))
}

function reportHandlerFailure(context: AdapterContext, event: string, error: unknown): void {
  const reason = errorMessage(error)
  context.debug(`Handler for '${event}' failed: ${reason}`)
  emitSocketLog(context, 'error', 'socket_handler_error', 'Socket event handler failed', {
    status: 'failure',
    reason,
    data: { socket_event: event }
  })
  context.socket.emit(SOCKET_EVENTS.SSH_ERROR, HANDLER_FAILURE_MESSAGE)
}

/**
 * Register a listener that validates its first argument before calling the
 * handler. Invalid payloads get an `ssherror` reply (or `onInvalid`, when
 * given); the handler never sees them. Synchronous throws and rejected promises are caught and reported, so
 * no listener can take the process down.
 */
export function registerGuardedListener<T>(
  context: AdapterContext,
  event: string,
  validate: PayloadValidator<T>,
  handle: PayloadHandler<T>,
  onInvalid?: InvalidPayloadReply
): void {
  const target = context.socket as unknown as ListenerTarget

  target.on(event, (...args: unknown[]) => {
    try {
      const result = validate(args[0])
      if (!result.ok) {
        reportInvalidPayload(context, event, result.error, onInvalid)
        return
      }

      const pending = handle(result.value)
      if (pending instanceof Promise) {
        pending.catch((error: unknown) => {
          reportHandlerFailure(context, event, error)
        })
      }
    } catch (error) {
      reportHandlerFailure(context, event, error)
    }
  })
}

// Events whose arguments may carry credentials, prompt answers or keystrokes.
// Only a shape summary is ever logged for these.
const SUMMARY_ONLY_EVENTS: ReadonlySet<string> = new Set([
  SOCKET_EVENTS.DATA,
  SOCKET_EVENTS.AUTH,
  SOCKET_EVENTS.PROMPT_RESPONSE,
  SOCKET_EVENTS.HOSTKEY_VERIFY_RESPONSE
])

const MAX_DEBUG_STRING_LENGTH = 256
const MAX_DEBUG_DEPTH = 6
const MAX_DEBUG_ENTRIES = 50

// Replace long strings with a size summary so oversized payloads never reach
// the debug output in full (onAny runs before validation)
function truncateLongStrings(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.length > MAX_DEBUG_STRING_LENGTH ? summarizePayload(value) : value
  }
  if (Buffer.isBuffer(value)) {
    return summarizePayload(value)
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (depth >= MAX_DEBUG_DEPTH) {
    return summarizePayload(value)
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_DEBUG_ENTRIES) {
      return summarizePayload(value)
    }
    return value.map((item: unknown) => truncateLongStrings(item, depth + 1))
  }
  const entries = Object.entries(value)
  if (entries.length > MAX_DEBUG_ENTRIES || entries.some(([key]) => key.length > MAX_SUMMARY_KEY_LENGTH)) {
    // Keys are client-controlled too; never copy an oversized one into the log
    return summarizePayload(value)
  }
  return Object.fromEntries(
    entries.map(([key, item]) => [key, truncateLongStrings(item, depth + 1)])
  )
}

const PRESENCE_FIELDS = ['password', 'privateKey', 'passphrase', 'responses', 'inputs'].map(createSafeKey)
const MAX_SUMMARY_KEYS = 20
const MAX_SUMMARY_KEY_LENGTH = 64

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function summarizeObject(value: object): Record<string, unknown> {
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  const summary: Record<string, unknown> = {
    type: 'object',
    keyCount: keys.length,
    keys: keys.slice(0, MAX_SUMMARY_KEYS).map((key) => key.slice(0, MAX_SUMMARY_KEY_LENGTH))
  }

  for (const field of PRESENCE_FIELDS) {
    if (Object.hasOwn(record, field)) {
      summary[`${field}_present`] = isPresent(safeGet(record, field))
    }
  }

  return summary
}

/**
 * Describe a value by type and size only, never its contents.
 * @pure
 */
export function summarizePayload(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    return { type: 'string', length: value.length }
  }
  if (Buffer.isBuffer(value)) {
    return { type: 'buffer', length: value.length }
  }
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length }
  }
  if (value === null) {
    return { type: 'null' }
  }
  if (typeof value === 'object') {
    return summarizeObject(value)
  }
  return { type: typeof value }
}

/**
 * Build the debug representation of an inbound event's arguments. Safe on any
 * payload type; never returns credential, prompt or keystroke contents.
 * @pure
 */
export function describeInboundEvent(event: string, args: readonly unknown[]): unknown {
  if (SUMMARY_ONLY_EVENTS.has(event)) {
    return args.map(summarizePayload)
  }

  try {
    return maskSensitive(truncateLongStrings([...args]))
  } catch {
    return args.map(summarizePayload)
  }
}
