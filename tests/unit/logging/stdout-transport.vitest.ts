import { describe, expect, it } from 'vitest'
import type { Writable } from 'node:stream'
import { createStdoutTransport, TransportBackpressureError } from '../../../app/logging/stdout-transport.js'

class WritableStub {
  public readonly lines: string[] = []
  public failNextWrite = false
  private drainHandler: (() => void) | null = null

  write(chunk: string): boolean {
    const value = typeof chunk === 'string' ? chunk : String(chunk)
    this.lines.push(value)
    if (this.failNextWrite) {
      this.failNextWrite = false
      if (this.drainHandler !== null) {
        setTimeout(() => {
          const handler = this.drainHandler
          this.drainHandler = null
          handler?.()
        }, 0)
      }
      return false
    }
    return true
  }

  once(event: string, handler: () => void): this {
    if (event === 'drain') {
      this.drainHandler = handler
    }
    return this
  }
}

describe('createStdoutTransport', () => {
  it('writes payloads to provided stream', () => {
    const stub = new WritableStub()
    const transport = createStdoutTransport({
      stream: stub as unknown as Writable,
      lineSeparator: '\n'
    })

    const result = transport.publish('{"event":"test"}')
    expect(result.ok).toBe(true)
    expect(stub.lines).toEqual(['{"event":"test"}\n'])
  })

  it('queues payloads when backpressure is signalled and flushes on drain', async () => {
    const stub = new WritableStub()
    stub.failNextWrite = true
    const transport = createStdoutTransport({
      stream: stub as unknown as Writable,
      lineSeparator: '\n'
    })

    const first = transport.publish('first')
    expect(first.ok).toBe(true)
    expect(stub.lines).toEqual(['first\n'])

    const second = transport.publish('second')
    expect(second.ok).toBe(true)
    expect(stub.lines).toEqual(['first\n'])

    await new Promise(resolve => setTimeout(resolve, 5))

    const flushResult = transport.flush()
    expect(flushResult.ok).toBe(true)

    expect(stub.lines).toEqual(['first\n', 'second\n'])
  })

  it('returns error when queue capacity is exceeded during backpressure', () => {
    const stub = new WritableStub()
    stub.failNextWrite = true
    const transport = createStdoutTransport({
      stream: stub as unknown as Writable,
      lineSeparator: '\n',
      maxQueueSize: 1
    })

    const first = transport.publish('primary')
    expect(first.ok).toBe(true)

    const second = transport.publish('secondary')
    expect(second.ok).toBe(true)

    const third = transport.publish('overflow')
    expect(third.ok).toBe(false)
    if (third.ok === false) {
      expect(third.error).toBeInstanceOf(TransportBackpressureError)
    }
  })
})
