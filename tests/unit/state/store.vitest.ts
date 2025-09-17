/**
 * Tests for SessionStore
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SessionStore, resetStore } from '../../../app/state/store.js'
import { actions } from '../../../app/state/actions.js'
import { createSessionId, createConnectionId } from '../../../app/types/branded.js'
import { TEST_USERNAME, TEST_SSH } from '../../test-constants.js'
import type { SessionState } from '../../../app/state/types.js'

// Test helpers
const createTestStore = () => new SessionStore({ maxHistorySize: 10 })

describe('SessionStore', () => {
  let store: SessionStore

  beforeEach(() => {
    resetStore()
    store = createTestStore()
  })

  describe('session management', () => {
    it('should create a new session', () => {
      const sessionId = createSessionId('test-123')
      const state = store.createSession(sessionId)
      
      expect(state).toBeDefined()
      expect(state.id).toBe(sessionId)
      expect(state.auth.status).toBe('pending')
    })

    it('should return existing session if already created', () => {
      const sessionId = createSessionId('test-123')
      const state1 = store.createSession(sessionId)
      const state2 = store.createSession(sessionId)
      
      expect(state1).toBe(state2)
    })

    it('should get state for existing session', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      const state = store.getState(sessionId)
      expect(state).toBeDefined()
      expect(state?.id).toBe(sessionId)
    })

    it('should return undefined for non-existent session', () => {
      const state = store.getState(createSessionId('non-existent'))
      expect(state).toBeUndefined()
    })

    it('should get all session IDs', () => {
      const id1 = createSessionId('test-1')
      const id2 = createSessionId('test-2')
      
      store.createSession(id1)
      store.createSession(id2)
      
      const ids = store.getSessionIds()
      expect(ids).toHaveLength(2)
      expect(ids).toContain(id1)
      expect(ids).toContain(id2)
    })

    it('should remove session', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      store.removeSession(sessionId)
      
      expect(store.getState(sessionId)).toBeUndefined()
      expect(store.getSessionIds()).toHaveLength(0)
    })
  })

  describe('dispatch', () => {
    it('should dispatch action and update state', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      
      const state = store.getState(sessionId)
      expect(state?.auth.status).toBe('pending')
      expect(state?.auth.username).toBe(TEST_USERNAME)
    })

    it('should not dispatch to non-existent session', () => {
      const sessionId = createSessionId('non-existent')
      
      // Should not throw
      expect(() => {
        store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      }).not.toThrow()
    })

    it('should handle multiple dispatches', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      store.dispatch(sessionId, actions.auth.success(TEST_USERNAME, 'manual'))
      store.dispatch(sessionId, actions.connection.start(TEST_SSH.HOST, TEST_SSH.PORT))
      
      const state = store.getState(sessionId)
      expect(state?.auth.status).toBe('authenticated')
      expect(state?.connection.status).toBe('connecting')
    })
  })

  describe('subscriptions', () => {
    it('should notify listeners on state change', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      const listener = vi.fn()
      store.subscribe(sessionId, listener)
      
      store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ auth: expect.objectContaining({ username: TEST_USERNAME }) }),
        expect.objectContaining({ auth: expect.objectContaining({ username: null }) })
      )
    })

    it('should not notify on no state change', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      const listener = vi.fn()
      store.subscribe(sessionId, listener)
      
      // Dispatch unknown action that doesn't change state
      store.dispatch(sessionId, { type: 'UNKNOWN' } as any)
      
      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle multiple listeners', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      store.subscribe(sessionId, listener1)
      store.subscribe(sessionId, listener2)
      
      store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      
      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })

    it('should unsubscribe listener', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      const listener = vi.fn()
      const unsubscribe = store.subscribe(sessionId, listener)
      
      store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      expect(listener).toHaveBeenCalledTimes(1)
      
      unsubscribe()
      
      store.dispatch(sessionId, actions.auth.success(TEST_USERNAME, 'manual'))
      expect(listener).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    it('should handle listener errors gracefully', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      const errorListener = vi.fn(() => { throw new Error('Listener error') })
      const normalListener = vi.fn()
      
      store.subscribe(sessionId, errorListener)
      store.subscribe(sessionId, normalListener)
      
      // Should not throw
      expect(() => {
        store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      }).not.toThrow()
      
      expect(errorListener).toHaveBeenCalled()
      expect(normalListener).toHaveBeenCalled()
    })
  })

  describe('action history', () => {
    it('should record action history', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      store.dispatch(sessionId, actions.auth.request('manual', TEST_USERNAME))
      store.dispatch(sessionId, actions.auth.success(TEST_USERNAME, 'manual'))
      
      const history = store.getActionHistory(sessionId)
      expect(history).toHaveLength(2)
      expect(history[0].type).toBe('AUTH_REQUEST')
      expect(history[1].type).toBe('AUTH_SUCCESS')
    })

    it('should limit history size', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      // Dispatch more actions than maxHistorySize
      for (let i = 0; i < 15; i++) {
        store.dispatch(sessionId, actions.connection.activity())
      }
      
      const history = store.getActionHistory(sessionId)
      expect(history).toHaveLength(10) // maxHistorySize from setup
    })

    it('should return empty array for non-existent session', () => {
      const history = store.getActionHistory(createSessionId('non-existent'))
      expect(history).toEqual([])
    })
  })

  describe('store statistics', () => {
    it('should return accurate statistics', () => {
      const id1 = createSessionId('test-1')
      const id2 = createSessionId('test-2')
      
      store.createSession(id1)
      store.createSession(id2)
      
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      
      store.subscribe(id1, listener1)
      store.subscribe(id1, listener2)
      store.subscribe(id2, listener1)
      
      store.dispatch(id1, actions.auth.request('manual', TEST_USERNAME))
      store.dispatch(id2, actions.connection.activity())
      
      const stats = store.getStats()
      expect(stats.sessionCount).toBe(2)
      expect(stats.listenerCount).toBe(3)
      expect(stats.totalActions).toBe(2)
    })
  })

  describe('clear', () => {
    it('should clear all sessions and listeners', () => {
      const id1 = createSessionId('test-1')
      const id2 = createSessionId('test-2')
      
      store.createSession(id1)
      store.createSession(id2)
      
      store.clear()
      
      expect(store.getSessionIds()).toHaveLength(0)
      expect(store.getStats().sessionCount).toBe(0)
      expect(store.getStats().listenerCount).toBe(0)
    })
  })

  describe('session end lifecycle', () => {
    it('should dispatch SESSION_END when removing session', () => {
      const sessionId = createSessionId('test-123')
      store.createSession(sessionId)
      
      const listener = vi.fn()
      store.subscribe(sessionId, listener)
      
      store.removeSession(sessionId)
      
      // Check that SESSION_END was dispatched
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          connection: expect.objectContaining({ status: 'closed' })
        }),
        expect.anything()
      )
    })
  })
})