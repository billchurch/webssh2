// app/logging/composite-transport.ts
// Utilities for composing and filtering log transports

import type { LogTransport } from './stdout-transport.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'

export function createCompositeTransport(
  transports: ReadonlyArray<LogTransport | undefined>
): LogTransport {
  const active = transports.filter((transport): transport is LogTransport => transport !== undefined)

  if (active.length === 0) {
    return createNoopTransport()
  }

  return {
    publish: (payload) => publishToAll(active, payload),
    flush: () => flushAll(active)
  }
}

export function createNoopTransport(): LogTransport {
  return {
    publish: () => ok(undefined),
    flush: () => ok(undefined)
  }
}

function publishToAll(transports: readonly LogTransport[], payload: string): Result<void> {
  let firstError: Error | undefined

  for (const transport of transports) {
    const result = transport.publish(payload)
    if (!result.ok && firstError === undefined) {
      firstError = result.error
    }
  }

  return firstError === undefined ? ok(undefined) : err(firstError)
}

function flushAll(transports: readonly LogTransport[]): Result<void> {
  let firstError: Error | undefined

  for (const transport of transports) {
    const result = transport.flush()
    if (!result.ok && firstError === undefined) {
      firstError = result.error
    }
  }

  return firstError === undefined ? ok(undefined) : err(firstError)
}
