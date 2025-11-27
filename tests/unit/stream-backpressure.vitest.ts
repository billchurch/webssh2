// tests/unit/stream-backpressure.vitest.ts
// Unit tests for stream backpressure configuration

import { describe, it, expect } from 'vitest'
import { createCompleteDefaultConfig } from '../../app/config/default-config.js'

describe('Stream Backpressure Configuration', () => {
  it('should have default maxExecOutputBytes of 10MB', () => {
    const config = createCompleteDefaultConfig()
    expect(config.ssh.maxExecOutputBytes).toBe(10 * 1024 * 1024)
  })

  it('should have default outputRateLimitBytesPerSec of 0 (unlimited)', () => {
    const config = createCompleteDefaultConfig()
    expect(config.ssh.outputRateLimitBytesPerSec).toBe(0)
  })

  it('should have default socketHighWaterMark of 16KB', () => {
    const config = createCompleteDefaultConfig()
    expect(config.ssh.socketHighWaterMark).toBe(16 * 1024)
  })

  it('should allow custom maxExecOutputBytes override', () => {
    const config = createCompleteDefaultConfig()
    config.ssh.maxExecOutputBytes = 5 * 1024 * 1024 // 5MB
    expect(config.ssh.maxExecOutputBytes).toBe(5 * 1024 * 1024)
  })

  it('should allow rate limiting to be enabled', () => {
    const config = createCompleteDefaultConfig()
    config.ssh.outputRateLimitBytesPerSec = 1024 * 1024 // 1MB/s
    expect(config.ssh.outputRateLimitBytesPerSec).toBe(1024 * 1024)
  })

  it('should validate rate limit is disabled when set to 0', () => {
    const config = createCompleteDefaultConfig()
    config.ssh.outputRateLimitBytesPerSec = 0
    expect(config.ssh.outputRateLimitBytesPerSec).toBe(0)
  })
})
