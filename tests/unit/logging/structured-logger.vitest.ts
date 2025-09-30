import { describe, expect, it } from 'vitest'
import { createStructuredLogger } from '../../../app/logging/structured-logger.js'
import type { LogTransport } from '../../../app/logging/stdout-transport.js'
import { ok } from '../../../app/utils/result.js'
import type { Result } from '../../../app/types/result.js'

class TransportStub implements LogTransport {
  public readonly lines: string[] = []

  publish(payload: string): Result<void> {
    this.lines.push(payload)
    return ok(undefined)
  }

  flush(): Result<void> {
    return ok(undefined)
  }
}

describe('createStructuredLogger', () => {
  it('filters entries below minimum level', () => {
    const transport = new TransportStub()
    const logger = createStructuredLogger({
      minimumLevel: 'warn',
      namespace: 'webssh2:test',
      transport,
      clock: () => new Date('2025-01-01T00:00:00.000Z')
    })

    const debugResult = logger.debug({
      event: 'session_start',
      message: 'should be ignored'
    })
    expect(debugResult.ok).toBe(true)

    const warnResult = logger.warn({
      event: 'session_start',
      message: 'accepted'
    })

    expect(warnResult.ok).toBe(true)
    expect(transport.lines).toHaveLength(1)
    const payload = JSON.parse(transport.lines[0]) as Record<string, unknown>
    expect(payload.level).toBe('warn')
    expect(payload.extra).toEqual({ logger_namespace: 'webssh2:test' })
  })

  it('propagates formatter errors', () => {
    const transport = new TransportStub()
    const logger = createStructuredLogger({
      transport,
      clock: () => new Date('invalid')
    })

    const result = logger.info({
      event: 'session_start'
    })

    expect(result.ok).toBe(false)
  })
})
