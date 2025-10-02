// app/middleware/ephemeral-session-store.ts
// Session store that mirrors MemoryStore without triggering production warnings

import session, { type SessionData } from 'express-session'

interface StoredSession {
  readonly payload: string
}

export interface EphemeralSessionStoreOptions {
  readonly cleanupIntervalMs?: number
}

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

const computeExpiration = (sessionCookie: session.Cookie): number | null => {
  if (typeof sessionCookie.originalMaxAge === 'number' && sessionCookie.originalMaxAge > 0) {
    return Date.now() + sessionCookie.originalMaxAge
  }

  if (typeof sessionCookie.maxAge === 'number' && sessionCookie.maxAge > 0) {
    return Date.now() + sessionCookie.maxAge
  }

  if (sessionCookie.expires instanceof Date) {
    return sessionCookie.expires.getTime()
  }

  return null
}

const isExpired = (data: SessionData): boolean => {
  const expiration = computeExpiration(data.cookie)
  if (expiration === null) {
    return false
  }

  return expiration <= Date.now()
}

const cloneSession = (data: SessionData): SessionData =>
  JSON.parse(JSON.stringify(data)) as SessionData

type SessionsCallback = (
  error: unknown,
  sessions?: SessionData[] | Record<string, SessionData> | null
) => void

export class EphemeralSessionStore extends session.Store {
  private readonly sessions = new Map<string, StoredSession>()

  constructor(options: EphemeralSessionStoreOptions = {}) {
    super()

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

    const sessionData = parseSession(record.payload)
    if (isExpired(sessionData)) {
      this.sessions.delete(sessionId)
      schedule(callback, undefined, undefined)
      return
    }

    schedule(callback, undefined, sessionData)
  }

  override set(
    sessionId: string,
    sessionData: SessionData,
    callback?: (error?: unknown) => void
  ): void {
    const payload = JSON.stringify(cloneSession(sessionData))
    this.sessions.set(sessionId, { payload })
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
    this.sessions.set(sessionId, { payload: JSON.stringify(stored) })

    if (callback !== undefined) {
      schedule(callback)
    }
  }

  private collectActiveSessions(): Array<{ sessionId: string; data: SessionData }> {
    const activeSessions: Array<{ sessionId: string; data: SessionData }> = []

    for (const [sessionId, record] of this.sessions.entries()) {
      const sessionData = parseSession(record.payload)
      if (isExpired(sessionData)) {
        this.sessions.delete(sessionId)
        continue
      }

      activeSessions.push({ sessionId, data: sessionData })
    }

    return activeSessions
  }

  private removeExpiredSessions(): void {
    for (const [sessionId, record] of this.sessions.entries()) {
      const sessionData = parseSession(record.payload)
      if (!isExpired(sessionData)) {
        continue
      }

      this.sessions.delete(sessionId)
    }
  }
}

export const createEphemeralSessionStore = (
  options: EphemeralSessionStoreOptions = {}
): EphemeralSessionStore => new EphemeralSessionStore(options)
