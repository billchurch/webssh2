/**
 * Rate Limiter Unit Tests
 *
 * Tests for SFTP transfer rate limiting.
 *
 * @module tests/unit/services/sftp/rate-limiter
 */

import { describe, it, expect, vi } from 'vitest'
import {
  RateLimiter,
  createRateLimiter,
  UNLIMITED_RATE_LIMITER
} from '../../../../app/services/sftp/rate-limiter.js'

describe('rate-limiter', () => {
  describe('RateLimiter', () => {
    describe('unlimited rate', () => {
      it('allows all transfers when bytesPerSecond is 0', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 0 })

        const result1 = limiter.checkAndUpdate(1000000)
        expect(result1.allowed).toBe(true)
        expect(result1.waitMs).toBe(0)

        const result2 = limiter.checkAndUpdate(1000000)
        expect(result2.allowed).toBe(true)
        expect(result2.waitMs).toBe(0)
      })

      it('tracks total bytes even when unlimited', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 0 })

        limiter.checkAndUpdate(1000)
        limiter.checkAndUpdate(2000)

        expect(limiter.getTotalBytes()).toBe(3000)
      })
    })

    describe('limited rate', () => {
      it('allows transfers within rate limit', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        const result = limiter.checkAndUpdate(500)
        expect(result.allowed).toBe(true)
        expect(result.waitMs).toBe(0)
      })

      it('allows transfers up to the limit', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        const result = limiter.checkAndUpdate(1000)
        expect(result.allowed).toBe(true)
        expect(result.waitMs).toBe(0)
      })

      it('blocks transfers exceeding rate limit', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        // First transfer fills the window
        limiter.checkAndUpdate(800)

        // Second transfer would exceed
        const result = limiter.checkAndUpdate(300)
        expect(result.allowed).toBe(false)
        expect(result.waitMs).toBeGreaterThan(0)
      })

      it('resets window after windowMs', () => {
        vi.useFakeTimers()

        const limiter = new RateLimiter({ bytesPerSecond: 1000, windowMs: 100 })

        // Fill the window
        limiter.checkAndUpdate(1000)

        // Immediately exceeds
        let result = limiter.checkAndUpdate(100)
        expect(result.allowed).toBe(false)

        // Wait for window to reset
        vi.advanceTimersByTime(100)

        // Should allow again
        result = limiter.checkAndUpdate(100)
        expect(result.allowed).toBe(true)

        vi.useRealTimers()
      })
    })

    describe('wouldAllow', () => {
      it('checks without updating state', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        expect(limiter.wouldAllow(500)).toBe(true)
        expect(limiter.wouldAllow(500)).toBe(true)
        expect(limiter.getTotalBytes()).toBe(0) // State not updated
      })

      it('returns false for exceeding bytes', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        limiter.checkAndUpdate(800)
        expect(limiter.wouldAllow(300)).toBe(false)
      })
    })

    describe('calculateCurrentRate', () => {
      it('calculates rate based on total transfer', () => {
        vi.useFakeTimers()

        const limiter = new RateLimiter({ bytesPerSecond: 0 })

        // Transfer 1000 bytes immediately
        limiter.checkAndUpdate(1000)

        // Advance time by 2 seconds
        vi.advanceTimersByTime(2000)

        // Rate should be ~500 bytes/sec (1000 bytes over 2 seconds)
        const rate = limiter.calculateCurrentRate()
        expect(rate).toBeGreaterThan(400)
        expect(rate).toBeLessThan(600)

        vi.useRealTimers()
      })
    })

    describe('pause and resume', () => {
      it('tracks paused state', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        expect(limiter.isPaused()).toBe(false)

        limiter.pause()
        expect(limiter.isPaused()).toBe(true)

        limiter.resume()
        expect(limiter.isPaused()).toBe(false)
      })

      it('resets window on resume', () => {
        vi.useFakeTimers()

        const limiter = new RateLimiter({ bytesPerSecond: 1000, windowMs: 100 })

        // Fill the window
        limiter.checkAndUpdate(1000)

        // Pause and resume
        limiter.pause()
        vi.advanceTimersByTime(50) // Not enough time for window reset
        limiter.resume()

        // Should allow transfer because resume resets window
        const result = limiter.checkAndUpdate(500)
        expect(result.allowed).toBe(true)

        vi.useRealTimers()
      })
    })

    describe('reset', () => {
      it('resets all state', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        limiter.checkAndUpdate(500)
        limiter.pause()

        limiter.reset()

        expect(limiter.getTotalBytes()).toBe(0)
        expect(limiter.isPaused()).toBe(false)
      })
    })

    describe('getConfig', () => {
      it('returns configuration', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 5000, windowMs: 500 })

        const config = limiter.getConfig()
        expect(config.bytesPerSecond).toBe(5000)
        expect(config.windowMs).toBe(500)
      })

      it('uses default windowMs when not specified', () => {
        const limiter = new RateLimiter({ bytesPerSecond: 1000 })

        const config = limiter.getConfig()
        expect(config.windowMs).toBe(1000)
      })
    })
  })

  describe('createRateLimiter', () => {
    it('creates a rate limiter with specified rate', () => {
      const limiter = createRateLimiter(5000)

      expect(limiter.getConfig().bytesPerSecond).toBe(5000)
    })

    it('creates unlimited limiter with 0', () => {
      const limiter = createRateLimiter(0)

      const result = limiter.checkAndUpdate(10000000)
      expect(result.allowed).toBe(true)
    })
  })

  describe('UNLIMITED_RATE_LIMITER', () => {
    it('is a singleton unlimited limiter', () => {
      const result = UNLIMITED_RATE_LIMITER.checkAndUpdate(999999999)
      expect(result.allowed).toBe(true)
      expect(result.waitMs).toBe(0)
    })
  })
})
