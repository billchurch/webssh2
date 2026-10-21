// app/middleware/ephemeral-session-store.ts
// Session store that mirrors MemoryStore without triggering production warnings

import session, { type SessionData } from 'express-session'
import { deserialize, serialize } from 'node:v8'

interface StoredSession {
  readonly payload: string
  /** Absolute expiry (ms since epoch), or null when the cookie has no lifetime. */
  readonly expiresAt: number | null
}

export interface EphemeralSessionStoreOptions {
  readonly cleanupIntervalMs?: number
  /** Max stored sessions before the least recently saved one is evicted. */
  readonly maxSessions?: number
  /** Clock (ms since epoch), injectable for deterministic tests. */
  readonly now?: () => number
}

const DEFAULT_MAX_SESSIONS = 10_000

const hasSetImmediate = typeof setImmediate === 'function'

const schedule = <T extends readonly unknown[]>(fn: (...args: T) => void, ...args: T): void => {
  if (hasSetImmediate) {
    setImmediate(() => {
      fn(...args)
    })
    return
  }

  process.nextTick(() => {
    fn(...args)
  })
}

const parseSession = (serialized: string): SessionData => JSON.parse(serialized) as SessionData

// Sessions are stored as JSON, so `cookie.expires` may be a Date (fresh from
// express-session) or an ISO string (round-tripped). Prefer it over maxAge:
// it is the absolute expiry, while maxAge is relative to "now".
const toTimestamp = (value: unknown): number | null => {
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : null
  }
  if (typeof value === 'string') {
    const time = Date.parse(value)
    return Number.isFinite(time) ? time : null
  }
  return null
}

const computeExpiration = (sessionCookie: session.Cookie | undefined, now: number): number | null => {
  if (sessionCookie === undefined) {
    return null
  }

  const expires = toTimestamp(sessionCookie.expires)
  if (expires !== null) {
    return expires
  }

  if (typeof sessionCookie.maxAge === 'number' && sessionCookie.maxAge > 0) {
    return now + sessionCookie.maxAge
  }

  return null
}

const isExpired = (record: StoredSession, now: number): boolean =>
  record.expiresAt !== null && record.expiresAt <= now

const cloneValue = <T>(value: T): T => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone<T>(value)
  }

  const serialized = serialize(value)
  return deserialize(serialized) as T
}

const cloneSession = (data: SessionData): SessionData => cloneValue(data)

type SessionsCallback = (
  error: unknown,
  sessions?: SessionData[] | Record<string, SessionData> | null
) => void

export class EphemeralSessionStore extends session.Store {
  // Map iteration order is insertion order; every write re-inserts its key,
  // so the first key is always the least recently saved session.
  private readonly sessions = new Map<string, StoredSession>()
  private readonly maxSessions: number
  private readonly now: () => number

  constructor(options: EphemeralSessionStoreOptions = {}) {
    super()

    this.maxSessions = Math.max(1, options.maxSessions ?? DEFAULT_MAX_SESSIONS)
    this.now = options.now ?? Date.now

    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60_000
    if (cleanupIntervalMs > 0) {
      const timer = setInterval(() => this.removeExpiredSessions(), cleanupIntervalMs)
      if (typeof timer.unref === 'function') {
        timer.unref()
      }
    }
  }

  override get(
    sessionId: string,
    callback: (error: unknown, session?: SessionData | null) => void
  ): void {
    const record = this.sessions.get(sessionId)

    if (record === undefined) {
      schedule(callback, undefined, undefined)
      return
    }

    if (isExpired(record, this.now())) {
      this.sessions.delete(sessionId)
      schedule(callback, undefined, undefined)
      return
    }

    schedule(callback, undefined, parseSession(record.payload))
  }

  override set(
    sessionId: string,
    sessionData: SessionData,
    callback?: (error?: unknown) => void
  ): void {
    const payload = JSON.stringify(cloneSession(sessionData))
    this.put(sessionId, { payload, expiresAt: computeExpiration(sessionData.cookie, this.now()) })
    if (callback !== undefined) {
      schedule(callback, undefined)
    }
  }

  override destroy(sessionId: string, callback?: (error?: unknown) => void): void {
    this.sessions.delete(sessionId)
    if (callback !== undefined) {
      schedule(callback, undefined)
    }
  }

  override clear(callback?: (error?: unknown) => void): void {
    this.sessions.clear()
    if (callback !== undefined) {
      schedule(callback, undefined)
    }
  }

  override length(callback: (error: unknown, length?: number) => void): void {
    const activeSessions = this.collectActiveSessions()
    schedule(callback, undefined, activeSessions.length)
  }

  override all(callback: SessionsCallback): void {
    const activeSessions = this.collectActiveSessions()
    const sessions = activeSessions.map(({ data }) => data)

    schedule(callback, undefined, sessions)
  }

  override touch(
    sessionId: string,
    sessionData: SessionData,
    callback?: () => void
  ): void {
    const record = this.sessions.get(sessionId)
    if (record === undefined) {
      if (callback !== undefined) {
        schedule(callback)
      }
      return
    }

    const stored = parseSession(record.payload)
    stored.cookie = sessionData.cookie
    this.put(sessionId, {
      payload: JSON.stringify(stored),
      expiresAt: computeExpiration(sessionData.cookie, this.now()),
    })

    if (callback !== undefined) {
      schedule(callback)
    }
  }

  private put(sessionId: string, record: StoredSession): void {
    this.sessions.delete(sessionId)
    this.sessions.set(sessionId, record)

    while (this.sessions.size > this.maxSessions) {
      const oldest = this.sessions.keys().next().value
      if (oldest === undefined) {
        return
      }
      this.sessions.delete(oldest)
    }
  }

  private collectActiveSessions(): Array<{ sessionId: string; data: SessionData }> {
    const activeSessions: Array<{ sessionId: string; data: SessionData }> = []
    const now = this.now()

    for (const [sessionId, record] of this.sessions.entries()) {
      if (isExpired(record, now)) {
        this.sessions.delete(sessionId)
        continue
      }

      activeSessions.push({ sessionId, data: parseSession(record.payload) })
    }

    return activeSessions
  }

  private removeExpiredSessions(): void {
    const now = this.now()
    for (const [sessionId, record] of this.sessions.entries()) {
      if (isExpired(record, now)) {
        this.sessions.delete(sessionId)
      }
    }
  }
}

export const createEphemeralSessionStore = (
  options: EphemeralSessionStoreOptions = {}
): EphemeralSessionStore => new EphemeralSessionStore(options)
