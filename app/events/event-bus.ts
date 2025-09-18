/**
 * Core event bus implementation
 */

import { randomUUID } from 'node:crypto'
import type { AppEvent, EventType, EventWithMetadata, EventPriority } from './types.js'
import { EventPriority as Priority } from './types.js'
import debug from 'debug'

const logger = debug('webssh2:events:bus')

/**
 * Event handler function type
 */
export type EventHandler<T extends AppEvent = AppEvent> = (
  event: T
) => void | Promise<void>

/**
 * Unsubscribe function returned when subscribing
 */
export type Unsubscribe = () => void

/**
 * Event filter function for conditional handling
 */
export type EventFilter<T extends AppEvent = AppEvent> = (event: T) => boolean

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  filter?: EventFilter
  priority?: EventPriority
  once?: boolean
}

/**
 * Handler registration info
 */
interface HandlerInfo {
  handler: EventHandler
  filter?: EventFilter
  priority: EventPriority
  once: boolean
  id: string
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  eventsPublished: number
  eventsProcessed: number
  eventsFailed: number
  queueSize: number
  handlerCounts: Record<string, number>
  processingTime: number
}

/**
 * Core event bus for publish/subscribe pattern
 */
export class EventBus {
  private readonly handlers = new Map<EventType, Set<HandlerInfo>>()
  private eventQueue: EventWithMetadata[] = []
  private processing = false
  private stats: EventBusStats = {
    eventsPublished: 0,
    eventsProcessed: 0,
    eventsFailed: 0,
    queueSize: 0,
    handlerCounts: {},
    processingTime: 0
  }
  private readonly maxQueueSize: number
  private readonly maxRetries: number

  constructor(options?: { maxQueueSize?: number; maxRetries?: number }) {
    this.maxQueueSize = options?.maxQueueSize ?? 10000
    this.maxRetries = options?.maxRetries ?? 3
  }

  /**
   * Subscribe to events of a specific type
   */
  subscribe<T extends EventType>(
    eventType: T,
    handler: EventHandler<Extract<AppEvent, { type: T }>>,
    options?: SubscriptionOptions
  ): Unsubscribe {
    const handlerInfo: HandlerInfo = {
      handler: handler as EventHandler,
      priority: options?.priority ?? Priority.NORMAL,
      once: options?.once ?? false,
      id: randomUUID()
    }

    // Add filter only if provided
    if (options?.filter !== undefined) {
      handlerInfo.filter = options.filter
    }

    const handlers = this.handlers.get(eventType) ?? new Set()
    handlers.add(handlerInfo)
    this.handlers.set(eventType, handlers)

    // Update stats
    // Use Object.defineProperty to avoid object injection warning
    Object.defineProperty(this.stats.handlerCounts, eventType, {
      value: handlers.size,
      writable: true,
      enumerable: true,
      configurable: true
    })

    logger('Subscribed to %s (id: %s, priority: %d)', eventType, handlerInfo.id, handlerInfo.priority)

    return () => {
      handlers.delete(handlerInfo)
      if (handlers.size === 0) {
        this.handlers.delete(eventType)
        // Use Reflect.deleteProperty to avoid object injection warning
        Reflect.deleteProperty(this.stats.handlerCounts, eventType)
      } else {
        // Use Object.defineProperty to avoid object injection warning
    Object.defineProperty(this.stats.handlerCounts, eventType, {
      value: handlers.size,
      writable: true,
      enumerable: true,
      configurable: true
    })
      }
      logger('Unsubscribed from %s (id: %s)', eventType, handlerInfo.id)
    }
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(
    handler: EventHandler<AppEvent>,
    options?: SubscriptionOptions
  ): Unsubscribe {
    const eventTypes = new Set<EventType>()
    const unsubscribes: Unsubscribe[] = []

    // Subscribe to all known event types
    const allEventTypes: EventType[] = [
      'auth.request', 'auth.success', 'auth.failure', 'auth.logout', 'auth.clear',
      'connection.request', 'connection.established', 'connection.ready',
      'connection.error', 'connection.closed', 'connection.timeout',
      'terminal.data.in', 'terminal.data.out', 'terminal.resize',
      'terminal.command', 'terminal.exec.start', 'terminal.exec.data', 'terminal.exec.exit',
      'session.created', 'session.updated', 'session.destroyed', 'session.timeout',
      'system.error', 'system.warning', 'system.info', 'system.metrics', 'system.health',
      'recording.start', 'recording.data', 'recording.stop',
      'replay.start', 'replay.progress', 'replay.stop'
    ]

    for (const eventType of allEventTypes) {
      eventTypes.add(eventType)
      unsubscribes.push(this.subscribe(eventType, handler, options))
    }

    return () => {
      for (const unsub of unsubscribes) {
        unsub()
      }
    }
  }

  /**
   * Publish an event to the bus
   */
  async publish(
    event: AppEvent,
    priority: EventPriority = Priority.NORMAL
  ): Promise<void> {
    // Check queue size
    if (this.eventQueue.length >= this.maxQueueSize) {
      logger('Event queue full, dropping event: %s', event.type)
      this.stats.eventsFailed++
      throw new Error(`Event queue full (max: ${this.maxQueueSize})`)
    }

    const eventWithMetadata: EventWithMetadata = {
      event,
      priority,
      timestamp: Date.now(),
      id: randomUUID(),
      retryCount: 0
    }

    // Add to queue based on priority
    if (priority === Priority.CRITICAL) {
      this.eventQueue.unshift(eventWithMetadata)
    } else {
      this.eventQueue.push(eventWithMetadata)
      // Always sort by priority to maintain correct order
      this.eventQueue.sort((a, b) => b.priority - a.priority)
    }

    this.stats.eventsPublished++
    this.stats.queueSize = this.eventQueue.length

    logger('Published event: %s (id: %s, priority: %d)', event.type, eventWithMetadata.id, priority)

    // Process queue if not already processing
    if (!this.processing) {
      await this.processQueue()
    }
  }

  /**
   * Publish multiple events
   */
  async publishMany(
    events: AppEvent[],
    priority: EventPriority = Priority.NORMAL
  ): Promise<void> {
    for (const event of events) {
      await this.publish(event, priority)
    }
  }

  /**
   * Process the event queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return
    }

    this.processing = true

    try {
      while (this.eventQueue.length > 0) {
        const eventMeta = this.eventQueue.shift()
        if (eventMeta === undefined) {
          continue
        }

        this.stats.queueSize = this.eventQueue.length

        const start = Date.now()
        const processed = await this.processEvent(eventMeta)
        const duration = Date.now() - start

        this.stats.processingTime += duration

        if (!processed && (eventMeta.retryCount ?? 0) < this.maxRetries) {
          // Retry failed event
          eventMeta.retryCount = (eventMeta.retryCount ?? 0) + 1
          this.eventQueue.push(eventMeta)
          logger('Retrying event: %s (attempt %d)', eventMeta.event.type, eventMeta.retryCount)
        }
      }
    } finally {
      this.processing = false
    }
  }

  /**
   * Process a single event
   */
  private async processEvent(eventMeta: EventWithMetadata): Promise<boolean> {
    const { event, id } = eventMeta
    const handlers = this.handlers.get(event.type)

    if (handlers === undefined || handlers.size === 0) {
      logger('No handlers for event: %s', event.type)
      return true
    }

    logger('Processing event: %s (id: %s, %d handlers)', event.type, id, handlers.size)

    let success = true
    const handlersToRemove = new Set<HandlerInfo>()

    // Sort handlers by priority
    const sortedHandlers = Array.from(handlers).sort((a, b) => b.priority - a.priority)

    for (const handlerInfo of sortedHandlers) {
      // Check filter
      if (handlerInfo.filter !== undefined && !handlerInfo.filter(event)) {
        continue
      }

      try {
        await handlerInfo.handler(event)
        this.stats.eventsProcessed++

        // Remove if one-time handler
        if (handlerInfo.once) {
          handlersToRemove.add(handlerInfo)
        }
      } catch (error) {
        this.stats.eventsFailed++
        success = false
        logger('Handler error for %s: %O', event.type, error)

        // Emit system error event
        if (event.type !== 'system.error') {
          await this.publish({
            type: 'system.error',
            payload: {
              error: error instanceof Error ? error.message : String(error),
              context: `EventHandler for ${event.type}`
            }
          }, Priority.HIGH)
        }
      }
    }

    // Remove one-time handlers
    for (const handler of handlersToRemove) {
      handlers.delete(handler)
    }

    return success
  }

  /**
   * Wait for event queue to be empty
   */
  async flush(): Promise<void> {
    while (this.processing || this.eventQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  /**
   * Clear all event handlers
   */
  clear(): void {
    this.handlers.clear()
    this.eventQueue = []
    this.stats.handlerCounts = {}
    logger('Cleared all handlers and queue')
  }

  /**
   * Get event bus statistics
   */
  getStats(): Readonly<EventBusStats> {
    return { ...this.stats }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      eventsPublished: 0,
      eventsProcessed: 0,
      eventsFailed: 0,
      queueSize: this.eventQueue.length,
      handlerCounts: { ...this.stats.handlerCounts },
      processingTime: 0
    }
  }

  /**
   * Check if there are handlers for a specific event type
   */
  hasHandlers(eventType: EventType): boolean {
    const handlers = this.handlers.get(eventType)
    return handlers !== undefined && handlers.size > 0
  }

  /**
   * Get the number of handlers for an event type
   */
  getHandlerCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.size ?? 0
  }

  /**
   * Get the current queue size
   */
  getQueueSize(): number {
    return this.eventQueue.length
  }
}