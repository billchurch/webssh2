/**
 * Simple dependency injection container
 */

import debug from 'debug'
import type { Config } from '../types/config.js'
import type { Logger, AuthService, SSHService, TerminalService, SessionService, Services } from './interfaces.js'
import type { SessionStore } from '../state/store.js'

const logger = debug('webssh2:services:container')

/**
 * Token type for dependency registration
 */
export type Token<T> = string & { __type?: T }

/**
 * Factory function for creating dependencies
 */
export type Factory<T> = () => T

/**
 * Async factory function for creating dependencies
 */
export type AsyncFactory<T> = () => Promise<T>

/**
 * Dependency injection container
 */
export class Container {
  private readonly instances = new Map<string, unknown>()
  private readonly factories = new Map<string, Factory<unknown>>()
  private readonly asyncFactories = new Map<string, AsyncFactory<unknown>>()
  private readonly resolving = new Set<string>()

  /**
   * Register a factory for creating dependencies
   */
  register<T>(token: Token<T> | string, factory: Factory<T>): void {
    const key = typeof token === 'string' ? token : String(token)
    logger('Registering factory:', key)
    this.factories.set(key, factory as Factory<unknown>)
  }

  /**
   * Register an async factory for creating dependencies
   */
  registerAsync<T>(token: Token<T> | string, factory: AsyncFactory<T>): void {
    const key = typeof token === 'string' ? token : String(token)
    logger('Registering async factory:', key)
    this.asyncFactories.set(key, factory as AsyncFactory<unknown>)
  }

  /**
   * Register a singleton instance
   */
  registerSingleton<T>(token: Token<T> | string, instance: T): void {
    const key = typeof token === 'string' ? token : String(token)
    logger('Registering singleton:', key)
    this.instances.set(key, instance)
  }

  /**
   * Resolve a dependency
   */
  resolve<T>(token: Token<T> | string): T {
    const key = typeof token === 'string' ? token : String(token)
    
    // Check for circular dependencies
    if (this.resolving.has(key)) {
      throw new Error(`Circular dependency detected for: ${key}`)
    }

    // Check if already instantiated
    if (this.instances.has(key)) {
      logger('Returning cached instance:', key)
      return this.instances.get(key) as T
    }

    // Check for factory
    const factory = this.factories.get(key)
    if (factory !== undefined) {
      logger('Creating instance from factory:', key)
      this.resolving.add(key)
      try {
        const instance = factory() as T
        // Don't cache factory results - factories should create new instances each time
        return instance
      } finally {
        this.resolving.delete(key)
      }
    }

    // Check for async factory (but throw error since this is sync resolve)
    if (this.asyncFactories.has(key)) {
      throw new Error(`Token "${key}" requires async resolution. Use resolveAsync() instead.`)
    }

    throw new Error(`No registration found for ${key}`)
  }

  /**
   * Resolve a dependency asynchronously
   */
  async resolveAsync<T>(token: Token<T> | string): Promise<T> {
    const key = typeof token === 'string' ? token : String(token)
    
    // Check for circular dependencies
    if (this.resolving.has(key)) {
      throw new Error(`Circular dependency detected for: ${key}`)
    }

    // Check if already instantiated
    if (this.instances.has(key)) {
      logger('Returning cached instance:', key)
      return this.instances.get(key) as T
    }

    // Check for async factory first
    const asyncFactory = this.asyncFactories.get(key)
    if (asyncFactory !== undefined) {
      logger('Creating instance from async factory:', key)
      this.resolving.add(key)
      try {
        const instance = await asyncFactory() as T
        this.instances.set(key, instance)
        return instance
      } finally {
        this.resolving.delete(key)
      }
    }

    // Fall back to sync factory
    const factory = this.factories.get(key)
    if (factory !== undefined) {
      logger('Creating instance from factory:', key)
      this.resolving.add(key)
      try {
        const instance = factory() as T
        this.instances.set(key, instance)
        return instance
      } finally {
        this.resolving.delete(key)
      }
    }

    throw new Error(`No registration found for ${key}`)
  }

  /**
   * Check if a token is registered
   */
  has(token: Token<unknown> | string): boolean {
    const key = typeof token === 'string' ? token : String(token)
    return this.instances.has(key) || 
           this.factories.has(key) || 
           this.asyncFactories.has(key)
  }

  /**
   * Get all registered tokens
   */
  getTokens(): string[] {
    const tokens = new Set<string>()
    
    for (const key of this.instances.keys()) {
      tokens.add(key)
    }
    for (const key of this.factories.keys()) {
      tokens.add(key)
    }
    for (const key of this.asyncFactories.keys()) {
      tokens.add(key)
    }
    
    return Array.from(tokens)
  }

  /**
   * Clear all registrations and instances
   */
  clear(): void {
    logger('Clearing container')
    this.instances.clear()
    this.factories.clear()
    this.asyncFactories.clear()
    this.resolving.clear()
  }

  /**
   * Create a child container that inherits from this one
   */
  createChild(): Container {
    const child = new Container()
    
    // Copy all registrations to child
    for (const [key, instance] of this.instances.entries()) {
      child.instances.set(key, instance)
    }
    for (const [key, factory] of this.factories.entries()) {
      child.factories.set(key, factory)
    }
    for (const [key, factory] of this.asyncFactories.entries()) {
      child.asyncFactories.set(key, factory)
    }
    
    logger('Created child container')
    return child
  }
}

/**
 * Create typed tokens for dependency injection
 */
export function createToken<T>(name: string): Token<T> {
  return name as Token<T>
}

/**
 * Create a new container instance
 */
export function createContainer(): Container {
  return new Container()
}

/**
 * Common service tokens
 */
export const TOKENS = {
  Config: createToken<Config>('Config'),
  Logger: createToken<Logger>('Logger'),
  SessionStore: createToken<SessionStore>('SessionStore'),
  AuthService: createToken<AuthService>('AuthService'),
  SSHService: createToken<SSHService>('SSHService'),
  TerminalService: createToken<TerminalService>('TerminalService'),
  SessionService: createToken<SessionService>('SessionService'),
  Services: createToken<Services>('Services')
} as const