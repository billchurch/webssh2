import { describe, it, expect } from 'vitest'
import { createRateLimiter } from '../../../app/security/rate-limiter.js'

describe('createRateLimiter', () => {
  it('allows up to capacity then blocks within the window', () => {
    const limiter = createRateLimiter({ capacity: 3, refillPerSec: 0, maxKeys: 100 })
    const t = 1000
    expect(limiter.allow('ip1', t)).toBe(true)
    expect(limiter.allow('ip1', t)).toBe(true)
    expect(limiter.allow('ip1', t)).toBe(true)
    expect(limiter.allow('ip1', t)).toBe(false)
  })

  it('refills over time', () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerSec: 1, maxKeys: 100 })
    expect(limiter.allow('ip1', 0)).toBe(true)
    expect(limiter.allow('ip1', 0)).toBe(false)
    expect(limiter.allow('ip1', 1000)).toBe(true)
  })

  it('does not exceed capacity when refilling', () => {
    const limiter = createRateLimiter({ capacity: 2, refillPerSec: 100, maxKeys: 100 })
    // long idle would overfill a naive impl; cap at capacity
    expect(limiter.allow('ip1', 0)).toBe(true)
    expect(limiter.allow('ip1', 100000)).toBe(true)
    expect(limiter.allow('ip1', 100000)).toBe(true)
    expect(limiter.allow('ip1', 100000)).toBe(false) // only `capacity` tokens, not thousands
  })

  it('isolates keys', () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerSec: 0, maxKeys: 100 })
    expect(limiter.allow('a', 0)).toBe(true)
    expect(limiter.allow('b', 0)).toBe(true)
  })

  it('evicts the oldest key when maxKeys is exceeded (bounds memory)', () => {
    const limiter = createRateLimiter({ capacity: 1, refillPerSec: 0, maxKeys: 2 })
    limiter.allow('a', 0)
    limiter.allow('b', 1)
    limiter.allow('c', 2) // evicts oldest ('a')
    expect(limiter.size()).toBeLessThanOrEqual(2)
  })
})
