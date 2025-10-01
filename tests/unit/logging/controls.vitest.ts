import { describe, expect, it } from 'vitest'
import {
  createLoggingControlState,
  evaluateLoggingControls
} from '../../../app/services/logging/controls.js'
import type { LoggingControlsConfig } from '../../../app/types/config.js'

describe('evaluateLoggingControls', () => {
  it('permits events when controls are not configured', () => {
    const initial = createLoggingControlState()

    const decision = evaluateLoggingControls({
      event: 'auth_attempt',
      nowMs: 0,
      state: initial
    })

    expect(decision.allow).toBe(true)
    expect(decision.reason).toBeUndefined()
    expect(decision.updatedState.metrics.published).toBe(1)
    expect(initial.metrics.published).toBe(0)
  })

  it('drops events when default sampling rate is zero', () => {
    const config: LoggingControlsConfig = {
      sampling: { defaultSampleRate: 0 }
    }
    const initial = createLoggingControlState()

    const decision = evaluateLoggingControls({
      event: 'session_start',
      nowMs: 0,
      state: initial,
      config,
      random: () => 0.75
    })

    expect(decision.allow).toBe(false)
    expect(decision.reason).toBe('sampling')
    expect(decision.details?.samplingRate).toBe(0)
    expect(decision.updatedState.metrics.droppedBySampling).toBe(1)
    expect(initial.metrics.droppedBySampling).toBe(0)
  })

  it('applies event specific sampling rules before wildcard rules', () => {
    const config: LoggingControlsConfig = {
      sampling: {
        defaultSampleRate: 1,
        rules: [
          { target: '*', sampleRate: 1 },
          { target: 'ssh_command', sampleRate: 0 }
        ]
      }
    }
    const initial = createLoggingControlState()

    const decision = evaluateLoggingControls({
      event: 'ssh_command',
      nowMs: 0,
      state: initial,
      config,
      random: () => 0.1
    })

    expect(decision.allow).toBe(false)
    expect(decision.reason).toBe('sampling')
    expect(decision.details?.samplingRate).toBe(0)
  })

  it('enforces rate limit rules with shared wildcard bucket', () => {
    const config: LoggingControlsConfig = {
      rateLimit: {
        rules: [{ target: '*', limit: 2, intervalMs: 1_000 }]
      }
    }
    let current = createLoggingControlState()

    const first = evaluateLoggingControls({
      event: 'auth_success',
      nowMs: 0,
      state: current,
      config,
      random: () => 0.5
    })
    expect(first.allow).toBe(true)
    current = first.updatedState

    const second = evaluateLoggingControls({
      event: 'auth_failure',
      nowMs: 100,
      state: current,
      config,
      random: () => 0.5
    })
    expect(second.allow).toBe(true)
    current = second.updatedState

    const third = evaluateLoggingControls({
      event: 'session_end',
      nowMs: 200,
      state: current,
      config,
      random: () => 0.5
    })

    expect(third.allow).toBe(false)
    expect(third.reason).toBe('rate_limit')
    expect(third.updatedState.metrics.droppedByRateLimit).toBe(1)

    const afterCooldown = evaluateLoggingControls({
      event: 'session_start',
      nowMs: 1_200,
      state: third.updatedState,
      config,
      random: () => 0.5
    })

    expect(afterCooldown.allow).toBe(true)
    expect(afterCooldown.updatedState.metrics.published).toBe(3)
  })

  it('treats rate limit rules independently per event when specified', () => {
    const config: LoggingControlsConfig = {
      rateLimit: {
        rules: [
          { target: 'auth_attempt', limit: 1, intervalMs: 1_000 },
          { target: 'ssh_command', limit: 1, intervalMs: 1_000 }
        ]
      }
    }
    let current = createLoggingControlState()

    const first = evaluateLoggingControls({
      event: 'auth_attempt',
      nowMs: 0,
      state: current,
      config,
      random: () => 0.3
    })
    expect(first.allow).toBe(true)
    current = first.updatedState

    const second = evaluateLoggingControls({
      event: 'ssh_command',
      nowMs: 100,
      state: current,
      config,
      random: () => 0.3
    })
    expect(second.allow).toBe(true)
    current = second.updatedState

    const third = evaluateLoggingControls({
      event: 'auth_attempt',
      nowMs: 200,
      state: current,
      config,
      random: () => 0.3
    })

    expect(third.allow).toBe(false)
    expect(third.reason).toBe('rate_limit')

    const authAfterInterval = evaluateLoggingControls({
      event: 'auth_attempt',
      nowMs: 1_200,
      state: third.updatedState,
      config,
      random: () => 0.3
    })

    expect(authAfterInterval.allow).toBe(true)
  })
})
