// tests/unit/middleware/ephemeral-session-store.vitest.ts
// Expiry and entry-cap behavior of the in-memory session store.

import { describe, it, expect } from 'vitest'
import type { SessionData } from 'express-session'
import { EphemeralSessionStore } from '../../../app/middleware/ephemeral-session-store.js'

const HOUR_MS = 3_600_000

const sessionExpiringAt = (expires: Date | string | undefined, maxAge?: number): SessionData =>
  ({
    cookie: { originalMaxAge: maxAge ?? null, maxAge, expires, path: '/', httpOnly: true },
  }) as unknown as SessionData

const getSession = (store: EphemeralSessionStore, id: string): Promise<SessionData | null | undefined> =>
  new Promise((resolve, reject) => {
    store.get(id, (error, data) => {
      if (error instanceof Error) {
        reject(error)
        return
      }
      resolve(data)
    })
  })

const setSession = (store: EphemeralSessionStore, id: string, data: SessionData): Promise<void> =>
  new Promise((resolve) => {
    store.set(id, data, () => {
      resolve()
    })
  })

const storeLength = (store: EphemeralSessionStore): Promise<number> =>
  new Promise((resolve) => {
    store.length((_error, length) => {
      resolve(length ?? 0)
    })
  })

const createStore = (clock: { now: number }, maxSessions?: number): EphemeralSessionStore =>
  new EphemeralSessionStore({
    cleanupIntervalMs: 0,
    now: () => clock.now,
    ...(maxSessions === undefined ? {} : { maxSessions }),
  })

describe('EphemeralSessionStore expiry', () => {
  it('returns a session before its cookie expires and drops it afterwards', async () => {
    const clock = { now: 1_000_000 }
    const store = createStore(clock)
    await setSession(store, 'a', sessionExpiringAt(new Date(clock.now + HOUR_MS), HOUR_MS))

    clock.now += HOUR_MS - 1
    expect(await getSession(store, 'a')).toBeDefined()

    clock.now += 1
    expect(await getSession(store, 'a')).toBeUndefined()
    expect(await storeLength(store)).toBe(0)
  })

  it('honors an ISO-string expiry (cookie round-tripped through JSON)', async () => {
    const clock = { now: 1_000_000 }
    const store = createStore(clock)
    await setSession(store, 'a', sessionExpiringAt(new Date(clock.now + 500).toISOString()))

    clock.now += 500
    expect(await getSession(store, 'a')).toBeUndefined()
  })

  it('falls back to maxAge when the cookie has no absolute expiry', async () => {
    const clock = { now: 1_000_000 }
    const store = createStore(clock)
    await setSession(store, 'a', sessionExpiringAt(undefined, 1000))

    clock.now += 999
    expect(await getSession(store, 'a')).toBeDefined()
    clock.now += 1
    expect(await getSession(store, 'a')).toBeUndefined()
  })

  it('extends expiry on touch', async () => {
    const clock = { now: 1_000_000 }
    const store = createStore(clock)
    await setSession(store, 'a', sessionExpiringAt(new Date(clock.now + 1000)))

    clock.now += 900
    await new Promise<void>((resolve) => {
      store.touch('a', sessionExpiringAt(new Date(clock.now + 1000)), resolve)
    })

    clock.now += 900
    expect(await getSession(store, 'a')).toBeDefined()
  })

  it('removes expired sessions on the cleanup interval', async () => {
    const clock = { now: 1_000_000 }
    const store = new EphemeralSessionStore({ cleanupIntervalMs: 5, now: () => clock.now })
    await setSession(store, 'a', sessionExpiringAt(new Date(clock.now + 10)))
    await setSession(store, 'b', sessionExpiringAt(new Date(clock.now + HOUR_MS)))

    clock.now += 10
    await new Promise((resolve) => setTimeout(resolve, 20))

    // `all` would also prune lazily; inspect the raw map so this pins the timer.
    const raw = (store as unknown as { sessions: Map<string, unknown> }).sessions
    expect([...raw.keys()]).toEqual(['b'])
  })
})

describe('EphemeralSessionStore entry cap', () => {
  it('evicts the oldest session first once the cap is reached', async () => {
    const clock = { now: 1_000_000 }
    const store = createStore(clock, 2)
    const data = sessionExpiringAt(new Date(clock.now + HOUR_MS))

    await setSession(store, 'a', data)
    await setSession(store, 'b', data)
    await setSession(store, 'c', data)

    expect(await getSession(store, 'a')).toBeUndefined()
    expect(await getSession(store, 'b')).toBeDefined()
    expect(await getSession(store, 'c')).toBeDefined()
    expect(await storeLength(store)).toBe(2)
  })

  it('treats a re-saved session as most recent', async () => {
    const clock = { now: 1_000_000 }
    const store = createStore(clock, 2)
    const data = sessionExpiringAt(new Date(clock.now + HOUR_MS))

    await setSession(store, 'a', data)
    await setSession(store, 'b', data)
    await setSession(store, 'a', data)
    await setSession(store, 'c', data)

    expect(await getSession(store, 'a')).toBeDefined()
    expect(await getSession(store, 'b')).toBeUndefined()
    expect(await getSession(store, 'c')).toBeDefined()
  })

  it('caps sessions that carry no expiry', async () => {
    const clock = { now: 1_000_000 }
    const store = createStore(clock, 3)
    for (let i = 0; i < 50; i++) {
      await setSession(store, `s${i}`, sessionExpiringAt(undefined))
    }

    expect(await storeLength(store)).toBe(3)
    expect(await getSession(store, 's49')).toBeDefined()
    expect(await getSession(store, 's46')).toBeUndefined()
  })
})
