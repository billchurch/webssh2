// tests/types/index.ts

/**
 * Common types and utilities for test files
 */

import type { Config } from '../../app/config.js'
import type { Server } from 'node:http'
import type { Express } from 'express'
import { TEST_SECRET_KEY, TEST_PORTS, TEST_TIMEOUTS } from '../test-constants.js'

/**
 * Environment variable map for testing
 */
export type TestEnvironment = Record<string, string | undefined>

/**
 * Test configuration options
 */
export interface TestConfig {
  /** Whether to skip network-dependent tests */
  skipNetwork?: boolean
  /** Timeout for async operations */
  timeout?: number
  /** Port to use for test server */
  port?: number
}

/**
 * Test server context for integration tests
 */
export interface TestServerContext {
  app: Express
  server: Server
  port: number
  baseUrl: string
}

/**
 * Mock SSH connection for testing
 */
export interface MockSSHConnection {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
}

/**
 * Test data builder result
 */
export type TestDataBuilder<T> = (overrides?: Partial<T>) => T

/**
 * Creates a test data builder function
 */
export function createTestDataBuilder<T>(defaults: T): TestDataBuilder<T> {
  return (overrides?: Partial<T>): T => ({
    ...defaults,
    ...overrides
  })
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E }

/**
 * Type guard for successful result
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true
}

/**
 * Type guard for error result
 */
export function isError<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return result.ok === false
}

/**
 * Socket event types for testing
 */
export interface SocketTestEvents {
  'auth': { username: string; password?: string; privateKey?: string }
  'resize': { cols: number; rows: number }
  'data': string | Buffer
  'disconnect': void
  'error': Error | string
  'connect': void
  'ready': void
}

/**
 * Test fixture for file system operations
 */
export interface FileSystemFixture {
  /** Temporary directory path */
  tempDir: string
  /** Create a temporary file with content */
  createFile: (name: string, content: string) => Promise<string>
  /** Clean up all temporary files */
  cleanup: () => Promise<void>
}

/**
 * Assertion helper types
 */
export interface AssertionHelpers {
  /** Assert that a promise rejects with specific error */
  rejects: (promise: Promise<unknown>, errorType?: unknown) => Promise<void>
  /** Assert that a function throws */
  throws: (fn: () => void, errorType?: unknown) => void
  /** Assert deep equality */
  deepEqual: <T>(actual: T, expected: T) => void
  /** Assert strict equality */
  strictEqual: <T>(actual: T, expected: T) => void
}

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIG: Config = {
  listen: {
    ip: '127.0.0.1',
    port: TEST_PORTS.webssh2
  },
  ssh: {
    host: 'localhost',
    port: TEST_PORTS.sshServer,
    term: 'xterm-256color',
    readyTimeout: 20000,
    keepaliveInterval: 120000,
    keepaliveCountMax: 10,
    disableInteractiveAuth: false
  },
  header: {
    text: null,
    background: 'green'
  },
  session: {
    name: 'webssh2.test.sid',
    secret: TEST_SECRET_KEY
  },
  options: {
    challengeButton: true,
    allowreauth: true
  },
  algorithms: {}
} as const

/**
 * Creates a delay for testing async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wraps a test function with timeout
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number = TEST_TIMEOUTS.medium
): Promise<T> {
  return Promise.race([
    fn(),
    delay(timeout).then(() => {
      throw new Error(`Test timeout after ${timeout}ms`)
    })
  ])
}

/**
 * Type for test cleanup functions
 */
export type CleanupFn = () => void | Promise<void>

/**
 * Manages cleanup functions for tests
 */
export class TestCleanup {
  private cleanupFns: CleanupFn[] = []

  add(fn: CleanupFn): void {
    this.cleanupFns.push(fn)
  }

  async runAll(): Promise<void> {
    for (const fn of this.cleanupFns.reverse()) {
      await fn()
    }
    this.cleanupFns = []
  }
}