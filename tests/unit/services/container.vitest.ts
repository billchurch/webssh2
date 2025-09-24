/**
 * Unit tests for Dependency Injection Container
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Container, createContainer, createToken, TOKENS } from '../../../app/services/container.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SECRET } from '../../test-constants.js'

describe('Container', () => {
  let container: Container

  beforeEach(() => {
    container = createContainer()
  })

  describe('basic registration and resolution', () => {
    it('should register and resolve factory', () => {
      const token = createToken<string>('test-string')
      const factory = () => 'Hello, World!'
      
      container.register(token, factory)
      const result = container.resolve(token)
      
      expect(result).toBe('Hello, World!')
    })

    it('should register and resolve singleton', () => {
      const token = createToken<{ value: number }>('test-object')
      const instance = { value: 42 }
      
      container.registerSingleton(token, instance)
      const result1 = container.resolve(token)
      const result2 = container.resolve(token)
      
      expect(result1).toBe(instance)
      expect(result2).toBe(instance)
      expect(result1).toBe(result2) // Same instance
    })

    it('should create new instance from factory each time', () => {
      const token = createToken<{ value: number }>('test-factory')
      let counter = 0
      const factory = () => ({ value: ++counter })
      
      container.register(token, factory)
      const result1 = container.resolve(token)
      const result2 = container.resolve(token)
      
      expect(result1.value).toBe(1)
      expect(result2.value).toBe(2)
      expect(result1).not.toBe(result2) // Different instances
    })

    it('should throw for unregistered token', () => {
      const token = createToken<string>('unregistered')
      
      expect(() => container.resolve(token)).toThrow('No registration found for unregistered')
    })
  })

  describe('async registration and resolution', () => {
    it('should register and resolve async factory', async () => {
      const token = createToken<string>('async-string')
      const asyncFactory = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'Async Result'
      }
      
      container.registerAsync(token, asyncFactory)
      const result = await container.resolveAsync(token)
      
      expect(result).toBe('Async Result')
    })

    it('should cache async results as singletons', async () => {
      const token = createToken<{ value: number }>('async-singleton')
      let counter = 0
      const asyncFactory = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { value: ++counter }
      }
      
      container.registerAsync(token, asyncFactory)
      const result1 = await container.resolveAsync(token)
      const result2 = await container.resolveAsync(token)
      
      expect(result1.value).toBe(1)
      expect(result2.value).toBe(1) // Same value - cached
      expect(result1).toBe(result2) // Same instance
    })

    it('should fall back to sync factory in async resolve', async () => {
      const token = createToken<string>('sync-in-async')
      const factory = () => 'Sync Result'
      
      container.register(token, factory)
      const result = await container.resolveAsync(token)
      
      expect(result).toBe('Sync Result')
    })
  })

  describe('circular dependency detection', () => {
    it('should detect direct circular dependency', () => {
      const tokenA = createToken<unknown>('A')
      const tokenB = createToken<unknown>('B')
      
      container.register(tokenA, () => container.resolve(tokenB))
      container.register(tokenB, () => container.resolve(tokenA))
      
      expect(() => container.resolve(tokenA)).toThrow('Circular dependency detected')
    })

    it('should detect indirect circular dependency', () => {
      const tokenA = createToken<unknown>('A')
      const tokenB = createToken<unknown>('B')
      const tokenC = createToken<unknown>('C')
      
      container.register(tokenA, () => container.resolve(tokenB))
      container.register(tokenB, () => container.resolve(tokenC))
      container.register(tokenC, () => container.resolve(tokenA))
      
      expect(() => container.resolve(tokenA)).toThrow('Circular dependency detected')
    })

    it('should handle non-circular complex dependencies', () => {
      const tokenA = createToken<{ name: string }>('A')
      const tokenB = createToken<{ value: number }>('B')
      const tokenC = createToken<{ a: any; b: any }>('C')
      
      container.register(tokenA, () => ({ name: 'Service A' }))
      container.register(tokenB, () => ({ value: 42 }))
      container.register(tokenC, () => ({
        a: container.resolve(tokenA),
        b: container.resolve(tokenB)
      }))
      
      const result = container.resolve(tokenC)
      
      expect(result.a.name).toBe('Service A')
      expect(result.b.value).toBe(42)
    })
  })

  describe('child containers', () => {
    it('should create child container with parent fallback', () => {
      const token = createToken<string>('parent-value')
      container.registerSingleton(token, 'Parent Value')
      
      const child = container.createChild()
      const result = child.resolve(token)
      
      expect(result).toBe('Parent Value')
    })

    it('should allow child to override parent registration', () => {
      const token = createToken<string>('shared-token')
      container.registerSingleton(token, 'Parent Value')
      
      const child = container.createChild()
      child.registerSingleton(token, 'Child Value')
      
      const parentResult = container.resolve(token)
      const childResult = child.resolve(token)
      
      expect(parentResult).toBe('Parent Value')
      expect(childResult).toBe('Child Value')
    })

    it('should isolate child registrations from parent', () => {
      const token = createToken<string>('child-only')
      
      const child = container.createChild()
      child.registerSingleton(token, 'Child Only Value')
      
      expect(() => container.resolve(token)).toThrow('No registration found')
      expect(child.resolve(token)).toBe('Child Only Value')
    })
  })

  describe('has method', () => {
    it('should return true for registered tokens', () => {
      const token = createToken<string>('exists')
      container.register(token, () => 'Value')
      
      expect(container.has(token)).toBe(true)
    })

    it('should return false for unregistered tokens', () => {
      const token = createToken<string>('not-exists')
      
      expect(container.has(token)).toBe(false)
    })

    it('should check parent container in child', () => {
      const token = createToken<string>('parent-token')
      container.register(token, () => 'Value')
      
      const child = container.createChild()
      
      expect(child.has(token)).toBe(true)
    })
  })

  describe('clear method', () => {
    it('should clear all registrations', () => {
      const token1 = createToken<string>('token1')
      const token2 = createToken<string>('token2')
      
      container.register(token1, () => 'Value 1')
      container.registerSingleton(token2, 'Value 2')
      
      container.clear()
      
      expect(() => container.resolve(token1)).toThrow()
      expect(() => container.resolve(token2)).toThrow()
    })

    it('should not affect parent when clearing child', () => {
      const token = createToken<string>('parent-token')
      container.register(token, () => 'Parent Value')
      
      const child = container.createChild()
      child.register(createToken<string>('child-token'), () => 'Child Value')
      
      child.clear()
      
      expect(container.resolve(token)).toBe('Parent Value')
    })
  })

  describe('real-world usage', () => {
    it('should resolve complex service dependencies', () => {
      // Define tokens
      const configToken = createToken<Config>('Config')
      const loggerToken = createToken<{ log: (msg: string) => void }>('Logger')
      const serviceToken = createToken<{ 
        config: Config
        logger: { log: (msg: string) => void }
        getName: () => string 
      }>('Service')
      
      // Register dependencies
      const mockConfig: Config = {
        session: { secret: TEST_SECRET, name: 'test' },
        ssh: {
          host: null,
          port: 22,
          term: 'xterm',
          readyTimeout: 20000,
          keepaliveInterval: 30000,
          keepaliveCountMax: 10,
          alwaysSendKeyboardInteractivePrompts: false
        },
        options: {
          challengeButton: false,
          allowReauth: true,
          allowReplay: false,
          allowReconnect: false,
          autoLog: false
        },
        algorithms: {},
        serverlog: { client: false, server: false },
        terminal: { cursorBlink: true, scrollback: 10000, tabStopWidth: 8, fontFamily: 'monospace' }
      }
      
      container.registerSingleton(configToken, mockConfig)
      container.register(loggerToken, () => ({
        log: vi.fn()
      }))
      container.register(serviceToken, () => ({
        config: container.resolve(configToken),
        logger: container.resolve(loggerToken),
        getName: () => 'TestService'
      }))
      
      // Resolve service
      const service = container.resolve(serviceToken)
      
      expect(service.config).toBe(mockConfig)
      expect(service.logger).toBeDefined()
      expect(service.getName()).toBe('TestService')
    })

    it('should work with predefined TOKENS', () => {
      // These tokens are defined in the container module
      const mockConfig: Config = {
        session: { secret: TEST_SECRET, name: 'test', sessionTimeout: 3600000 },
        ssh: {
          host: null,
          port: 22,
          term: 'xterm',
          readyTimeout: 20000,
          keepaliveInterval: 30000,
          keepaliveCountMax: 10,
          alwaysSendKeyboardInteractivePrompts: false
        },
        options: {
          challengeButton: false,
          allowReauth: true,
          allowReplay: false,
          allowReconnect: false,
          autoLog: false
        },
        algorithms: {},
        serverlog: { client: false, server: false },
        terminal: { cursorBlink: true, scrollback: 10000, tabStopWidth: 8, fontFamily: 'monospace' }
      }
      
      container.registerSingleton(TOKENS.Config, mockConfig)
      
      const config = container.resolve(TOKENS.Config)
      expect(config).toBe(mockConfig)
    })
  })

  describe('error handling', () => {
    it('should provide helpful error messages', () => {
      const token = createToken<unknown>('missing-dependency')
      
      try {
        container.resolve(token)
        expect.fail('Should have thrown')
      } catch (error: any) {
        expect(error.message).toContain('No registration found for missing-dependency')
      }
    })

    it('should handle factory errors gracefully', () => {
      const token = createToken<unknown>('error-factory')
      container.register(token, () => {
        throw new Error('Factory error')
      })
      
      expect(() => container.resolve(token)).toThrow('Factory error')
    })

    it('should handle async factory errors', async () => {
      const token = createToken<unknown>('async-error')
      container.registerAsync(token, async () => {
        throw new Error('Async factory error')
      })
      
      await expect(container.resolveAsync(token)).rejects.toThrow('Async factory error')
    })
  })
})