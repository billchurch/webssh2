/**
 * Event bus unit tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus } from '../../../app/events/event-bus.js'
import { EventPriority } from '../../../app/events/types.js'
import type { AppEvent } from '../../../app/events/types.js'

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus({ maxQueueSize: 100, maxRetries: 2 })
  })

  describe('subscribe', () => {
    it('should subscribe to specific event type', () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.subscribe('auth.request', handler)

      expect(eventBus.hasHandlers('auth.request')).toBe(true)
      expect(eventBus.getHandlerCount('auth.request')).toBe(1)
      expect(typeof unsubscribe).toBe('function')
    })

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe('auth.request', handler1)
      eventBus.subscribe('auth.request', handler2)

      expect(eventBus.getHandlerCount('auth.request')).toBe(2)
    })

    it('should unsubscribe handler', () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.subscribe('auth.request', handler)

      expect(eventBus.hasHandlers('auth.request')).toBe(true)

      unsubscribe()

      expect(eventBus.hasHandlers('auth.request')).toBe(false)
    })

    it('should support subscription options', () => {
      const handler = vi.fn()
      const filter = vi.fn().mockReturnValue(true)

      eventBus.subscribe('auth.request', handler, {
        filter,
        priority: EventPriority.HIGH,
        once: true
      })

      expect(eventBus.hasHandlers('auth.request')).toBe(true)
    })
  })

  describe('publish', () => {
    it('should publish event to handlers', async () => {
      const handler = vi.fn()
      const event: AppEvent = {
        type: 'auth.request',
        payload: {
          sessionId: 'test-session' as any,
          method: 'basic',
          username: 'test'
        }
      }

      eventBus.subscribe('auth.request', handler)
      await eventBus.publish(event)

      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const event: AppEvent = {
        type: 'auth.success',
        payload: {
          sessionId: 'test-session' as any,
          userId: 'test-user' as any,
          username: 'test',
          method: 'basic'
        }
      }

      eventBus.subscribe('auth.success', handler)
      await eventBus.publish(event)

      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should process events in priority order', async () => {
      const callOrder: number[] = []
      const handler1 = vi.fn(() => callOrder.push(1))
      const handler2 = vi.fn(() => callOrder.push(2))
      const handler3 = vi.fn(() => callOrder.push(3))

      const event: AppEvent = {
        type: 'connection.request',
        payload: {
          sessionId: 'test' as any,
          host: 'localhost',
          port: 22
        }
      }

      eventBus.subscribe('connection.request', handler1, { priority: EventPriority.LOW })
      eventBus.subscribe('connection.request', handler2, { priority: EventPriority.HIGH })
      eventBus.subscribe('connection.request', handler3, { priority: EventPriority.NORMAL })

      await eventBus.publish(event)

      expect(callOrder).toEqual([2, 3, 1]) // HIGH, NORMAL, LOW
    })

    it('should handle handler errors gracefully', async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error('Handler error'))
      const handler2 = vi.fn()

      const event: AppEvent = {
        type: 'system.error',
        payload: {
          error: 'test error',
          context: 'test'
        }
      }

      eventBus.subscribe('system.error', handler1)
      eventBus.subscribe('system.error', handler2)

      await eventBus.publish(event)

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should retry failed events', async () => {
      const handler = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce(undefined)

      const event: AppEvent = {
        type: 'terminal.data.in',
        payload: {
          sessionId: 'test' as any,
          data: 'test data'
        }
      }

      eventBus.subscribe('terminal.data.in', handler)
      await eventBus.publish(event)

      // Should be called twice due to retry
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should enforce queue size limit', async () => {
      const smallBus = new EventBus({ maxQueueSize: 2 })

      // Add a blocking handler to keep events in the queue
      let blocked = true
      const handler = vi.fn().mockImplementation(async () => {
        while (blocked) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      })
      smallBus.subscribe('test' as any, handler)

      // First event starts processing but blocks
      const promise1 = smallBus.publish({
        type: 'test' as any,
        payload: { i: 1 }
      } as any)

      // Give it time to start processing
      await new Promise(resolve => setTimeout(resolve, 5))

      // Second event goes to queue
      const promise2 = smallBus.publish({
        type: 'test' as any,
        payload: { i: 2 }
      } as any)

      // Third should also go to queue
      const promise3 = smallBus.publish({
        type: 'test' as any,
        payload: { i: 3 }
      } as any)

      // Fourth one should fail - one processing, two in queue, max is 2
      const promise4 = smallBus.publish({
        type: 'test' as any,
        payload: { i: 4 }
      } as any).catch(err => err.message)

      // Check that the fourth one failed
      const result = await promise4
      expect(result).toBe('Event queue full (max: 2)')

      // Clean up
      blocked = false
      await Promise.all([promise1, promise2, promise3])
    })
  })

  describe('subscribeAll', () => {
    it('should subscribe to all event types', async () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.subscribeAll(handler)

      const events: AppEvent[] = [
        {
          type: 'auth.request',
          payload: { sessionId: 'test' as any, method: 'basic', username: 'test' }
        },
        {
          type: 'connection.established',
          payload: { sessionId: 'test' as any, connectionId: 'conn' as any, host: 'localhost', port: 22 }
        },
        {
          type: 'terminal.resize',
          payload: { sessionId: 'test' as any, rows: 24, cols: 80 }
        }
      ]

      for (const event of events) {
        await eventBus.publish(event)
      }

      expect(handler).toHaveBeenCalledTimes(3)
      expect(handler).toHaveBeenCalledWith(events[0])
      expect(handler).toHaveBeenCalledWith(events[1])
      expect(handler).toHaveBeenCalledWith(events[2])

      unsubscribe()
    })
  })

  describe('once option', () => {
    it('should only call handler once', async () => {
      const handler = vi.fn()
      const event: AppEvent = {
        type: 'session.created',
        payload: { sessionId: 'test' as any }
      }

      eventBus.subscribe('session.created', handler, { once: true })

      await eventBus.publish(event)
      await eventBus.publish(event)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(eventBus.hasHandlers('session.created')).toBe(false)
    })
  })

  describe('filter option', () => {
    it('should filter events based on condition', async () => {
      const handler = vi.fn()
      const filter = (event: AppEvent) => {
        if (event.type === 'auth.request') {
          return event.payload.method === 'basic'
        }
        return false
      }

      eventBus.subscribe('auth.request', handler, { filter })

      await eventBus.publish({
        type: 'auth.request',
        payload: { sessionId: 'test' as any, method: 'basic', username: 'test' }
      })

      await eventBus.publish({
        type: 'auth.request',
        payload: { sessionId: 'test' as any, method: 'manual', username: 'test' }
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('statistics', () => {
    it('should track event statistics', async () => {
      const handler = vi.fn()
      eventBus.subscribe('auth.request', handler)

      const event: AppEvent = {
        type: 'auth.request',
        payload: { sessionId: 'test' as any, method: 'basic', username: 'test' }
      }

      await eventBus.publish(event)

      const stats = eventBus.getStats()
      expect(stats.eventsPublished).toBe(1)
      expect(stats.eventsProcessed).toBe(1)
      expect(stats.eventsFailed).toBe(0)
      expect(stats.handlerCounts['auth.request']).toBe(1)
    })

    it('should reset statistics', async () => {
      const handler = vi.fn()
      eventBus.subscribe('auth.request', handler)

      await eventBus.publish({
        type: 'auth.request',
        payload: { sessionId: 'test' as any, method: 'basic', username: 'test' }
      })

      eventBus.resetStats()

      const stats = eventBus.getStats()
      expect(stats.eventsPublished).toBe(0)
      expect(stats.eventsProcessed).toBe(0)
    })
  })

  describe('queue management', () => {
    it('should process events in order', async () => {
      const results: number[] = []
      const handler = vi.fn((event: AppEvent) => {
        if (event.type === 'system.info') {
          results.push((event.payload as any).order)
        }
      })

      eventBus.subscribe('system.info', handler)

      for (let i = 1; i <= 5; i++) {
        await eventBus.publish({
          type: 'system.info',
          payload: { message: `Event ${i}`, order: i }
        } as any)
      }

      expect(results).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle critical priority events first', async () => {
      // Test that critical events jump to front of queue
      const smallBus = new EventBus({ maxQueueSize: 10 })
      const results: string[] = []

      // Don't process immediately - block processing
      let processBlocked = true
      const handler = vi.fn().mockImplementation(async (event: AppEvent) => {
        while (processBlocked) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        if (event.type === 'system.error') {
          results.push(event.payload.context)
        }
      })

      smallBus.subscribe('system.error', handler)

      // Queue events while processing is blocked
      const p1 = smallBus.publish({
        type: 'system.error',
        payload: { error: 'first', context: 'first' }
      }, EventPriority.NORMAL)

      // Give first one time to start processing (but be blocked)
      await new Promise(resolve => setTimeout(resolve, 5))

      // Now add more events that will queue
      smallBus.publish({
        type: 'system.error',
        payload: { error: 'low', context: 'low' }
      }, EventPriority.LOW)

      smallBus.publish({
        type: 'system.error',
        payload: { error: 'critical', context: 'critical' }
      }, EventPriority.CRITICAL)

      // Unblock processing
      processBlocked = false

      // Wait for everything to finish
      await smallBus.flush()

      // First should process first (already started), then critical (jumped queue), then low
      expect(results).toEqual(['first', 'critical', 'low'])
    })
  })

  describe('flush', () => {
    it('should wait for all events to be processed', async () => {
      const handler = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 10))
      )

      eventBus.subscribe('system.info', handler)

      // Publish multiple events
      for (let i = 0; i < 3; i++) {
        eventBus.publish({
          type: 'system.info',
          payload: { message: `Event ${i}` }
        })
      }

      // Flush should wait for all to complete
      await eventBus.flush()

      expect(handler).toHaveBeenCalledTimes(3)
    })
  })

  describe('clear', () => {
    it('should clear all handlers and queue', () => {
      const handler = vi.fn()
      eventBus.subscribe('auth.request', handler)
      eventBus.subscribe('connection.request', handler)

      expect(eventBus.hasHandlers('auth.request')).toBe(true)
      expect(eventBus.hasHandlers('connection.request')).toBe(true)

      eventBus.clear()

      expect(eventBus.hasHandlers('auth.request')).toBe(false)
      expect(eventBus.hasHandlers('connection.request')).toBe(false)
      expect(eventBus.getQueueSize()).toBe(0)
    })
  })
})