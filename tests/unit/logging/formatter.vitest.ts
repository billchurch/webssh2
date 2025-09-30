import { describe, expect, it } from 'vitest'
import { formatStructuredLog } from '../../../app/logging/formatter.js'

const fixedDate = new Date('2025-01-01T00:00:00.000Z')
const clock = (): Date => fixedDate

describe('formatStructuredLog', () => {
  it('formats structured log with context and data', () => {
    const result = formatStructuredLog(
      {
        level: 'info',
        event: 'session_start',
        message: 'user connected',
        context: {
          sessionId: 'session-123',
          requestId: 'req-1',
          username: 'jdoe',
          clientIp: '198.51.100.1',
          clientPort: 44321,
          targetHost: '10.0.0.5',
          targetPort: 22,
          protocol: 'ssh',
          subsystem: 'shell',
          status: 'success'
        },
        data: {
          agent: 'web',
          version: '2.0.0'
        }
      },
      { clock, namespace: 'webssh2:test' }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const payload = JSON.parse(result.value) as Record<string, unknown>
    expect(payload.ts).toBe(fixedDate.toISOString())
    expect(payload.level).toBe('info')
    expect(payload.event).toBe('session_start')
    expect(payload.session_id).toBe('session-123')
    expect(payload.request_id).toBe('req-1')
    expect(payload.client_ip).toBe('198.51.100.1')
    expect(payload.client_port).toBe(44321)
    expect(payload.details).toEqual({ agent: 'web', version: '2.0.0' })
    expect(payload.extra).toEqual({ logger_namespace: 'webssh2:test' })
  })

  it('rejects invalid numeric context values', () => {
    const result = formatStructuredLog(
      {
        level: 'info',
        event: 'ssh_command',
        context: {
          sessionId: 'session-123',
          durationMs: -10
        }
      },
      { clock }
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('durationMs')
    }
  })

  it('serialises error details when provided', () => {
    const error = new Error('boom')
    const result = formatStructuredLog(
      {
        level: 'error',
        event: 'error',
        message: 'unhandled error',
        error
      },
      { clock }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const payload = JSON.parse(result.value) as Record<string, unknown>
    expect(payload.error_details).toMatchObject({
      message: 'boom',
      name: 'Error'
    })
  })
})
