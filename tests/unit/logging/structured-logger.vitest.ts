import { describe, expect, it } from 'vitest'
import { createStructuredLogger } from '../../../app/logging/structured-logger.js'
import {
  TransportBackpressureError,
  type LogTransport
} from '../../../app/logging/stdout-transport.js'
import { ok, err } from '../../../app/utils/result.js'
import type { Result } from '../../../app/types/result.js'

class TransportStub implements LogTransport {
  public readonly lines: string[] = []
  public nextError: Error | null = null

  publish(payload: string): Result<void> {
    if (this.nextError !== null) {
      const error = this.nextError
      this.nextError = null
      return err(error)
    }
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

  it('applies sampling controls before writing to transport', () => {
    const transport = new TransportStub()
    const logger = createStructuredLogger({
      transport,
      controls: {
        sampling: { defaultSampleRate: 0 }
      },
      random: () => 0.25
    })

    const result = logger.info({
      event: 'session_start',
      message: 'should be dropped'
    })

    expect(result.ok).toBe(true)
    expect(transport.lines).toHaveLength(0)
    const metrics = logger.snapshotMetrics()
    expect(metrics.droppedBySampling).toBe(1)
    expect(metrics.published).toBe(0)
  })

  it('tracks queue drops when transport reports backpressure', () => {
    const transport = new TransportStub()
    const logger = createStructuredLogger({
      transport,
      random: () => 0.1
    })

    transport.nextError = new TransportBackpressureError()

    const result = logger.info({ event: 'session_start' })

    expect(result.ok).toBe(true)
    expect(transport.lines).toHaveLength(0)
    const metrics = logger.snapshotMetrics()
    expect(metrics.droppedByQueue).toBe(1)
    expect(metrics.lastError).toBeInstanceOf(TransportBackpressureError)
  })

  it('resets control state when controls are updated', () => {
    const transport = new TransportStub()
    const logger = createStructuredLogger({
      transport,
      controls: {
        sampling: { defaultSampleRate: 0 }
      },
      random: () => 0.5
    })

    logger.info({ event: 'session_start' })
    expect(logger.snapshotMetrics().droppedBySampling).toBe(1)

    logger.updateControls(undefined)
    expect(logger.snapshotMetrics().droppedBySampling).toBe(0)
  })
})
