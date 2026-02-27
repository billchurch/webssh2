import { describe, it, expect, beforeEach } from 'vitest'
import type { Socket } from 'node:net'
import { createConnectionId, createSessionId } from '../../../../app/types/branded.js'
import { TelnetConnectionPool, type TelnetConnection } from '../../../../app/services/telnet/telnet-connection-pool.js'

/**
 * Create a mock TelnetConnection for testing pool behavior.
 * The socket is a mock object since we are testing pool operations, not socket behavior.
 */
const createMockConnection = (
  id: string,
  sessionId: string,
  host = 'localhost',
  port = 23
): TelnetConnection => ({
  id: createConnectionId(id),
  sessionId: createSessionId(sessionId),
  protocol: 'telnet' as const,
  status: 'connected',
  createdAt: Date.now(),
  lastActivity: Date.now(),
  host,
  port,
  socket: {} as Socket,
})

describe('TelnetConnectionPool', () => {
  let pool: TelnetConnectionPool

  beforeEach(() => {
    pool = new TelnetConnectionPool()
  })

  it('should add and retrieve connections', () => {
    const conn = createMockConnection('conn-1', 'session-1')
    pool.add(conn)

    const retrieved = pool.get(createConnectionId('conn-1'))
    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe(conn.id)
    expect(retrieved?.sessionId).toBe(conn.sessionId)
    expect(retrieved?.host).toBe('localhost')
    expect(retrieved?.port).toBe(23)
  })

  it('should return undefined for missing connection', () => {
    const result = pool.get(createConnectionId('nonexistent'))
    expect(result).toBeUndefined()
  })

  it('should get connections by session', () => {
    const sessionId = 'session-1'
    const conn1 = createMockConnection('conn-1', sessionId)
    const conn2 = createMockConnection('conn-2', sessionId)
    const conn3 = createMockConnection('conn-3', 'session-2')

    pool.add(conn1)
    pool.add(conn2)
    pool.add(conn3)

    const sessionConnections = pool.getBySession(createSessionId(sessionId))
    expect(sessionConnections).toHaveLength(2)

    const ids = sessionConnections.map((c) => c.id)
    expect(ids).toContain(conn1.id)
    expect(ids).toContain(conn2.id)
  })

  it('should return empty array for unknown session', () => {
    const result = pool.getBySession(createSessionId('unknown-session'))
    expect(result).toEqual([])
  })

  it('should remove connections', () => {
    const conn = createMockConnection('conn-1', 'session-1')
    pool.add(conn)

    const removed = pool.remove(createConnectionId('conn-1'))
    expect(removed).toBe(true)
    expect(pool.get(createConnectionId('conn-1'))).toBeUndefined()
    expect(pool.size).toBe(0)
  })

  it('should return false when removing nonexistent connection', () => {
    const removed = pool.remove(createConnectionId('nonexistent'))
    expect(removed).toBe(false)
  })

  it('should clear all connections', () => {
    pool.add(createMockConnection('conn-1', 'session-1'))
    pool.add(createMockConnection('conn-2', 'session-1'))
    pool.add(createMockConnection('conn-3', 'session-2'))

    expect(pool.size).toBe(3)

    pool.clear()

    expect(pool.size).toBe(0)
    expect(pool.get(createConnectionId('conn-1'))).toBeUndefined()
    expect(pool.getBySession(createSessionId('session-1'))).toEqual([])
    expect(pool.getBySession(createSessionId('session-2'))).toEqual([])
  })

  it('should track size', () => {
    expect(pool.size).toBe(0)

    pool.add(createMockConnection('conn-1', 'session-1'))
    expect(pool.size).toBe(1)

    pool.add(createMockConnection('conn-2', 'session-1'))
    expect(pool.size).toBe(2)

    pool.add(createMockConnection('conn-3', 'session-2'))
    expect(pool.size).toBe(3)

    pool.remove(createConnectionId('conn-1'))
    expect(pool.size).toBe(2)

    pool.remove(createConnectionId('conn-2'))
    expect(pool.size).toBe(1)
  })

  it('should clean up session index when last connection for session is removed', () => {
    const conn1 = createMockConnection('conn-1', 'session-1')
    const conn2 = createMockConnection('conn-2', 'session-1')

    pool.add(conn1)
    pool.add(conn2)

    expect(pool.getBySession(createSessionId('session-1'))).toHaveLength(2)

    pool.remove(createConnectionId('conn-1'))
    expect(pool.getBySession(createSessionId('session-1'))).toHaveLength(1)

    pool.remove(createConnectionId('conn-2'))
    expect(pool.getBySession(createSessionId('session-1'))).toEqual([])
  })
})
