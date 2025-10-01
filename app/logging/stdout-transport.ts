// app/logging/stdout-transport.ts
// Streaming transport that writes structured logs to stdout

import type { Writable } from 'node:stream'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'

export interface LogTransport {
  publish(payload: string): Result<void>
  flush(): Result<void>
}

export interface StdoutTransportOptions {
  readonly stream?: Writable
  readonly lineSeparator?: string
}

export function createStdoutTransport(options: StdoutTransportOptions = {}): LogTransport {
  const stream = options.stream ?? process.stdout
  const lineSeparator: string = options.lineSeparator ?? '\n'
  const queue: string[] = []
  let waitingForDrain = false
  let drainListenerAttached = false

  const publish = (payload: string): Result<void> => {
    if (waitingForDrain) {
      queue.push(payload)
      return ok(undefined)
    }

    const writeResult = writePayloadToStream(stream, lineSeparator, payload)
    if (!writeResult.ok) {
      return writeResult
    }

    if (!writeResult.value) {
      waitingForDrain = true
      attachDrainListener()
    }

    return ok(undefined)
  }

  const flush = (): Result<void> => {
    if (queue.length === 0) {
      waitingForDrain = false
      return ok(undefined)
    }

    while (queue.length > 0) {
      const nextPayload = queue[0]
      if (nextPayload === undefined) {
        queue.shift()
        continue
      }
      const writeResult = writePayloadToStream(stream, lineSeparator, nextPayload)
      if (!writeResult.ok) {
        return writeResult
      }

      if (!writeResult.value) {
        waitingForDrain = true
        attachDrainListener()
        return ok(undefined)
      }
      queue.shift()
    }

    waitingForDrain = false
    return ok(undefined)
  }

  const handleDrain = (): void => {
    const result = flush()
    if (!result.ok) {
      // Best effort: report failure to stderr without throwing
      console.error('Failed to flush stdout transport queue:', result.error)
    }
  }

  function attachDrainListener(): void {
    if (drainListenerAttached) {
      return
    }
    drainListenerAttached = true
    stream.once('drain', () => {
      drainListenerAttached = false
      handleDrain()
    })
  }

  return {
    publish,
    flush
  }
}

function writePayloadToStream(
  stream: Writable,
  lineSeparator: string,
  payload: string
): Result<boolean> {
  try {
    const canWrite = stream.write(`${payload}${lineSeparator}`)
    return ok(canWrite)
  } catch (error) {
    const failure =
      error instanceof Error ? error : new Error('Failed to write structured log to stream')
    return err(failure)
  }
}
