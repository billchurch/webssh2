import { describe, expect, it } from 'vitest'
import { LOG_EVENT_NAMES, isLogEventName } from '../../../app/logging/event-catalog.js'

describe('LOG_EVENT_NAMES', () => {
  it('includes csp_violation as a registered log event name', () => {
    expect((LOG_EVENT_NAMES as readonly string[]).includes('csp_violation')).toBe(true)
  })

  it('isLogEventName returns true for csp_violation', () => {
    expect(isLogEventName('csp_violation')).toBe(true)
  })
})
