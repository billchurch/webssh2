// app/security/rate-limiter.ts
// Minimal in-process token-bucket limiter keyed by an arbitrary string (e.g.
// client IP). Dependency-free (honors the 14-day quarantine policy). Memory is
// bounded via LRU-style eviction so spraying many distinct keys cannot grow the
// map without bound. The clock is injected (`now`, ms) for deterministic tests.
//
// Clock-skew note: if `now` < `bucket.last` (negative elapsed), the refill
// term is negative, so Math.min(capacity, tokens + negative) reduces or holds
// tokens. This biases toward throttling — the safe direction.

export interface RateLimiterOptions {
  /** Max burst tokens per key. */
  readonly capacity: number
  /** Tokens regenerated per second. */
  readonly refillPerSec: number
  /** Max distinct keys tracked before oldest-eviction. */
  readonly maxKeys: number
}

interface Bucket {
  tokens: number
  last: number
}

export interface RateLimiter {
  /** Consume a token for `key` at time `now` (ms). Returns true if allowed. */
  allow(key: string, now: number): boolean
  size(): number
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, Bucket>()

  const touch = (key: string, bucket: Bucket): void => {
    // Re-insert to move the key to the most-recently-used end (Map preserves
    // insertion order; deleting + setting refreshes recency).
    buckets.delete(key)
    buckets.set(key, bucket)
  }

  const evictIfNeeded = (): void => {
    while (buckets.size > options.maxKeys) {
      const oldest = buckets.keys().next().value
      if (oldest === undefined) {
        return
      }
      buckets.delete(oldest)
    }
  }

  return {
    allow(key: string, now: number): boolean {
      const existing = buckets.get(key)
      const bucket: Bucket = existing ?? { tokens: options.capacity, last: now }
      if (existing !== undefined) {
        const elapsedSec = (now - bucket.last) / 1000
        bucket.tokens = Math.min(
          options.capacity,
          bucket.tokens + elapsedSec * options.refillPerSec,
        )
        bucket.last = now
      }
      touch(key, bucket)
      evictIfNeeded()
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1
        return true
      }
      return false
    },
    size(): number {
      return buckets.size
    },
  }
}
