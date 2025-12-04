/**
 * Rate Limiter for SFTP Transfers
 *
 * Provides transfer rate limiting with:
 * - Sliding window byte tracking
 * - Pause/resume signaling
 * - Accurate rate calculation
 *
 * This is adapted from the terminal rate limiting pattern in service-socket-terminal.ts
 *
 * @module services/sftp/rate-limiter
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum bytes per second (0 = unlimited) */
  readonly bytesPerSecond: number
  /** Window size in milliseconds for rate calculation */
  readonly windowMs?: number
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the bytes can be transferred immediately */
  readonly allowed: boolean
  /** If not allowed, milliseconds to wait before retry */
  readonly waitMs: number
  /** Current transfer rate in bytes per second */
  readonly currentRate: number
}

/**
 * Rate limiter state (internal)
 */
interface RateLimiterState {
  /** Bytes transferred in current window */
  bytesInWindow: number
  /** Start time of current window */
  windowStart: number
  /** Whether rate limiting is paused */
  paused: boolean
  /** Total bytes transferred (for rate calculation) */
  totalBytes: number
  /** Start time of transfer */
  startTime: number
}

/**
 * Rate Limiter for transfer operations
 *
 * Implements a sliding window algorithm to enforce byte rate limits.
 * When the rate is exceeded, it calculates how long to wait before
 * the next transfer can proceed.
 */
export class RateLimiter {
  private readonly bytesPerSecond: number
  private readonly windowMs: number
  private state: RateLimiterState

  /**
   * Create a new rate limiter
   *
   * @param config - Rate limiter configuration
   */
  constructor(config: RateLimiterConfig) {
    this.bytesPerSecond = config.bytesPerSecond
    this.windowMs = config.windowMs ?? 1000
    this.state = {
      bytesInWindow: 0,
      windowStart: Date.now(),
      paused: false,
      totalBytes: 0,
      startTime: Date.now()
    }
  }

  /**
   * Check if bytes can be transferred and update state
   *
   * @param bytes - Number of bytes to transfer
   * @returns Rate limit check result
   */
  checkAndUpdate(bytes: number): RateLimitResult {
    // Unlimited rate
    if (this.bytesPerSecond <= 0) {
      this.state.totalBytes += bytes
      return {
        allowed: true,
        waitMs: 0,
        currentRate: this.calculateCurrentRate()
      }
    }

    const now = Date.now()
    const windowElapsed = now - this.state.windowStart

    // Reset window if expired
    if (windowElapsed >= this.windowMs) {
      this.state.bytesInWindow = 0
      this.state.windowStart = now
    }

    // Check if we can transfer
    if (this.state.bytesInWindow + bytes <= this.bytesPerSecond) {
      this.state.bytesInWindow += bytes
      this.state.totalBytes += bytes
      return {
        allowed: true,
        waitMs: 0,
        currentRate: this.calculateCurrentRate()
      }
    }

    // Rate exceeded - calculate wait time
    const waitMs = this.windowMs - windowElapsed

    return {
      allowed: false,
      waitMs: Math.max(1, waitMs),
      currentRate: this.calculateCurrentRate()
    }
  }

  /**
   * Check if bytes can be transferred without updating state
   *
   * @param bytes - Number of bytes to check
   * @returns Whether the transfer would be allowed
   */
  wouldAllow(bytes: number): boolean {
    if (this.bytesPerSecond <= 0) {
      return true
    }

    const now = Date.now()
    const windowElapsed = now - this.state.windowStart

    // Would reset window
    if (windowElapsed >= this.windowMs) {
      return bytes <= this.bytesPerSecond
    }

    return this.state.bytesInWindow + bytes <= this.bytesPerSecond
  }

  /**
   * Calculate current transfer rate
   *
   * @returns Average bytes per second since start
   */
  calculateCurrentRate(): number {
    const elapsed = Date.now() - this.state.startTime
    if (elapsed <= 0) {
      return 0
    }
    return Math.floor((this.state.totalBytes * 1000) / elapsed)
  }

  /**
   * Get total bytes transferred
   */
  getTotalBytes(): number {
    return this.state.totalBytes
  }

  /**
   * Get elapsed time in milliseconds
   */
  getElapsedMs(): number {
    return Date.now() - this.state.startTime
  }

  /**
   * Pause rate limiting (bytes will still be tracked)
   */
  pause(): void {
    this.state.paused = true
  }

  /**
   * Resume rate limiting
   */
  resume(): void {
    this.state.paused = false
    // Reset window on resume to avoid burst
    this.state.windowStart = Date.now()
    this.state.bytesInWindow = 0
  }

  /**
   * Check if rate limiting is paused
   */
  isPaused(): boolean {
    return this.state.paused
  }

  /**
   * Reset the rate limiter state
   */
  reset(): void {
    const now = Date.now()
    this.state = {
      bytesInWindow: 0,
      windowStart: now,
      paused: false,
      totalBytes: 0,
      startTime: now
    }
  }

  /**
   * Get configuration
   */
  getConfig(): RateLimiterConfig {
    return {
      bytesPerSecond: this.bytesPerSecond,
      windowMs: this.windowMs
    }
  }
}

/**
 * Create a rate limiter for a transfer
 *
 * @param bytesPerSecond - Maximum bytes per second (0 = unlimited)
 * @returns New rate limiter instance
 */
export function createRateLimiter(bytesPerSecond: number): RateLimiter {
  return new RateLimiter({ bytesPerSecond })
}

/**
 * Null rate limiter for unlimited transfers
 *
 * This is a no-op implementation that always allows transfers.
 */
export const UNLIMITED_RATE_LIMITER: RateLimiter = new RateLimiter({ bytesPerSecond: 0 })
