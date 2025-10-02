import { describe, expect, it } from 'vitest'
import { formatSyslogMessage } from '../../../app/logging/syslog-formatter.js'

const SAMPLE_PAYLOAD = JSON.stringify({
  ts: '2025-01-02T03:04:05.678Z',
  level: 'info',
  event: 'session_start',
  session_id: 'session-123',
  username: 'jdoe',
  client_ip: '198.51.100.10',
  status: 'success',
  message: 'Session started'
})

describe('syslog formatter', () => {
  it('renders RFC 5424 header with structured data', () => {
    const result = formatSyslogMessage(SAMPLE_PAYLOAD, {
      hostname: 'gateway-1',
      appName: 'webssh2-test',
      procId: '1234',
      enterpriseId: 32473,
      facility: 16
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const message = result.value
    expect(message).toContain('<134>1 2025-01-02T03:04:05.678Z gateway-1 webssh2-test 1234 session_start [webssh2@32473')
    expect(message).toContain('session_id="session-123"')
    expect(message).toContain('client_ip="198.51.100.10"')
    expect(message.endsWith(' Session started')).toBe(true)
  })

  it('falls back to JSON body when includeJson is true', () => {
    const result = formatSyslogMessage(SAMPLE_PAYLOAD, {
      includeJson: true
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const message = result.value
    expect(message.endsWith(` ${SAMPLE_PAYLOAD}`)).toBe(true)
  })
})
