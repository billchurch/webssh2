/**
 * Consolidated test utilities for all test files
 * Uses Vitest framework exclusively
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable security/detect-object-injection */
/* eslint-disable security/detect-non-literal-fs-filename */

import { EventEmitter } from 'node:events'
import { vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SessionStore } from '../app/state/store.js'
import type { ServiceDependencies } from '../app/services/interfaces.js'
import type { StructuredLogger, StructuredLoggerOptions } from '../app/logging/structured-logger.js'
import type { StructuredLogInput } from '../app/logging/structured-log.js'
import type { LogLevel } from '../app/logging/levels.js'
import type { TestEnvironment, AuthStatus } from './types/index.js'
import { TEST_USERNAME, TEST_SSH, TEST_SECRET } from './test-constants.js'
import { DEFAULTS, DEFAULT_AUTH_METHODS } from '../app/constants/index.js'
import type { Result } from '../app/types/result.js'
import { ok, err, isErr } from '../app/utils/result.js'
import { createAuthMethod } from '../app/types/branded.js'

// Re-export Result utility functions for test use
export { ok, err, isErr } from '../app/utils/result.js'

export interface StructuredLoggerStub extends StructuredLogger {
  readonly entries: Array<{ level: LogLevel; entry: Omit<StructuredLogInput, 'level'> }>
}

export function createStructuredLoggerStub(): StructuredLoggerStub {
  const entries: Array<{ level: LogLevel; entry: Omit<StructuredLogInput, 'level'> }> = []

  const record = (level: LogLevel, entry: Omit<StructuredLogInput, 'level'>): ReturnType<typeof ok<void>> => {
    entries.push({ level, entry: cloneEntry(entry) })
    return ok(undefined)
  }

  const cloneEntry = (entry: Omit<StructuredLogInput, 'level'>): Omit<StructuredLogInput, 'level'> => ({
    ...entry,
    context: entry.context === undefined ? undefined : { ...entry.context },
    data: entry.data === undefined ? undefined : { ...entry.data }
  })

  return {
    entries,
    log: ({ level, ...rest }) => record(level, rest),
    debug: (entry) => record('debug', entry),
    info: (entry) => record('info', entry),
    warn: (entry) => record('warn', entry),
    error: (entry) => record('error', entry),
    flush: () => ok(undefined)
  }
}

/**
 * Creates a mock SessionStore for testing
 */
export function createMockStore(): SessionStore {
  return {
    dispatch: vi.fn(),
    getState: vi.fn(),
    createSession: vi.fn(),
    removeSession: vi.fn(),
    getSessionIds: vi.fn(() => []),
    hasSession: vi.fn(() => false),
    getHistory: vi.fn(() => []),
    clear: vi.fn(),
    subscribe: vi.fn()
  } as unknown as SessionStore
}

/**
 * Creates mock Services for testing socket handlers
 */
export function createMockServices(options: {
  authSucceeds?: boolean
  sshConnectSucceeds?: boolean
  shellSucceeds?: boolean
  execSucceeds?: boolean
} = {}): unknown {
  const {
    authSucceeds = true,
    sshConnectSucceeds = true,
    shellSucceeds = true,
    execSucceeds = true
  } = options

  const mockStream = new EventEmitter()
  mockStream.write = vi.fn()
  mockStream.setWindow = vi.fn()

  return {
    auth: {
      authenticate: vi.fn(() => Promise.resolve(
        authSucceeds
          ? { ok: true, value: { sessionId: 'test-session', userId: 'test-user', username: 'testuser', method: 'manual' } }
          : { ok: false, error: new Error('Auth failed') }
      )),
      validateSession: vi.fn(() => ({ ok: true, value: true })),
      revokeSession: vi.fn(() => Promise.resolve({ ok: true, value: undefined })),
      getSessionInfo: vi.fn(() => ({ ok: true, value: null }))
    },
    ssh: {
      connect: vi.fn(() => Promise.resolve(
        sshConnectSucceeds
          ? {
              ok: true,
              value: {
                id: 'test-conn-id',
                sessionId: 'test-session',
                client: new EventEmitter(),
                status: 'connected',
                createdAt: Date.now(),
                lastActivity: Date.now(),
                host: TEST_SSH.HOST,
                port: TEST_SSH.PORT,
                username: TEST_USERNAME
              }
            }
          : { ok: false, error: new Error('SSH connection failed') }
      )),
      shell: vi.fn(() => Promise.resolve(
        shellSucceeds
          ? { ok: true, value: mockStream }
          : { ok: false, error: new Error('Shell failed') }
      )),
      exec: vi.fn((connectionId: string, command: string) => {
        if (!execSucceeds) {
          return Promise.resolve({ ok: false, error: new Error('Exec failed') })
        }
        const execStream = new EventEmitter()
        execStream.stderr = new EventEmitter()
        process.nextTick(() => {
          execStream.emit('data', Buffer.from(`OUT:${command}`))
          execStream.stderr.emit('data', Buffer.from('ERR:warn'))
          execStream.emit('close', 0, null)
        })
        return Promise.resolve({ ok: true, value: { stdout: '', stderr: '', code: 0 } })
      }),
      disconnect: vi.fn(() => Promise.resolve({ ok: true, value: undefined })),
      getConnectionStatus: vi.fn(() => ({ ok: true, value: null }))
    },
    terminal: {
      create: vi.fn(() => ({ ok: true, value: { id: 'test-term-id', sessionId: 'test-session', term: 'xterm-256color', rows: 24, cols: 80, env: {} } })),
      resize: vi.fn(() => ({ ok: true, value: undefined })),
      write: vi.fn(() => ({ ok: true, value: undefined })),
      destroy: vi.fn(() => ({ ok: true, value: undefined })),
      getTerminal: vi.fn(() => ({ ok: true, value: null }))
    },
    session: {
      create: vi.fn(() => ({ ok: true, value: { id: 'test-session', state: {}, createdAt: Date.now(), updatedAt: Date.now() } })),
      get: vi.fn(() => ({ ok: true, value: null })),
      update: vi.fn(() => ({ ok: true, value: { id: 'test-session', state: {}, createdAt: Date.now(), updatedAt: Date.now() } })),
      delete: vi.fn(() => ({ ok: true, value: undefined })),
      list: vi.fn(() => ({ ok: true, value: [] }))
    }
  }
}

/**
 * Creates mock ServiceDependencies for testing
 */
export function createMockDependencies(): ServiceDependencies {
  const loggerFactory = vi.fn((_options?: StructuredLoggerOptions) => {
    return createStructuredLoggerStub()
  })

  return {
    config: {
      session: {
        secret: TEST_SECRET,
        name: 'test-session',
        sessionTimeout: 3600000,
        maxHistorySize: 100
      },
      ssh: {
        host: null,
        port: 22,
        term: 'xterm-256color',
        readyTimeout: 20000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 10,
        alwaysSendKeyboardInteractivePrompts: false,
        disableInteractiveAuth: false,
        allowedAuthMethods: DEFAULT_AUTH_METHODS.map(createAuthMethod),
        algorithms: {
          kex: ['ecdh-sha2-nistp256', 'diffie-hellman-group14-sha1'],
          cipher: ['aes128-ctr', 'aes256-ctr'],
          serverHostKey: ['ssh-rsa', 'ssh-ed25519'],
          hmac: ['hmac-sha2-256', 'hmac-sha1'],
          compress: ['none']
        }
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
      terminal: {
        cursorBlink: true,
        scrollback: 10000,
        tabStopWidth: 8,
        fontFamily: 'monospace'
      },
      logging: { level: 'info', namespace: 'webssh2:test' }
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    },
    createStructuredLogger: loggerFactory
  }
}

/**
 * Creates a mock SSH2 client for testing
 */
export function createMockSSH2Client(): unknown {
  return {
    connect: vi.fn(),
    shell: vi.fn(),
    exec: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn()
  }
}

/**
 * Create base auth state properties
 */
function createBaseAuthState(status: AuthStatus) {
  return {
    status,
    username: status === 'authenticated' ? TEST_USERNAME : null,
    method: status === 'authenticated' ? 'manual' as const : null,
    timestamp: Date.now(),
    errorMessage: null
  }
}

/**
 * Creates a standard auth state for testing
 */
export function createAuthState(status: AuthStatus = 'authenticated') {
  return {
    auth: createBaseAuthState(status)
  }
}

/**
 * Create base connection state properties
 */
function createBaseConnectionState(status: 'idle' | 'connecting' | 'connected' | 'closed') {
  return {
    status,
    host: status === 'idle' ? null : TEST_SSH.HOST,
    port: status === 'idle' ? null : TEST_SSH.PORT,
    connectionId: status === 'connected' ? 'test-conn-id' : null,
    errorMessage: null
  }
}

/**
 * Create base terminal state properties
 */
function createBaseTerminalState(rows: number, cols: number) {
  return {
    terminalId: null,
    rows,
    cols,
    environment: {}
  }
}

/**
 * Create base metadata state properties
 */
function createBaseMetadataState() {
  const now = Date.now()
  return {
    createdAt: now - 1000,
    updatedAt: now,
    userId: null,
    clientIp: null,
    userAgent: null
  }
}

/**
 * Creates a standard session state for testing
 */
export function createSessionState(overrides?: {
  authStatus?: AuthStatus
  connectionStatus?: 'idle' | 'connecting' | 'connected' | 'closed'
  terminalRows?: number
  terminalCols?: number
}) {
  const {
    authStatus = 'authenticated',
    connectionStatus = 'connected',
    terminalRows = 24,
    terminalCols = 80
  } = overrides ?? {}

  return {
    auth: createBaseAuthState(authStatus),
    connection: createBaseConnectionState(connectionStatus),
    terminal: createBaseTerminalState(terminalRows, terminalCols),
    metadata: createBaseMetadataState()
  }
}

/**
 * Helper to set up mock store state
 */
export function setupMockStoreState(mockStore: SessionStore, state: unknown) {
  (mockStore.getState as any).mockReturnValue(state)
  return mockStore
}

/**
 * Helper to set up multiple mock store states (for sequential calls)
 */
export function setupMockStoreStates(mockStore: SessionStore, ...states: unknown[]) {
  const mockObj = mockStore.getState as any
  for (const state of states) {
    mockObj.mockReturnValueOnce(state)
  }
  if (states.length > 0) {
    mockObj.mockReturnValue(states.at(-1))
  }
  return mockStore
}

// =============================================================================
// Environment Variable Management
// =============================================================================

/**
 * Check if a key is a test-relevant environment variable
 */
function isTestEnvironmentVariable(key: string): boolean {
  return key.startsWith('WEBSSH2_') || key === 'PORT'
}

/**
 * Get all test-relevant environment variables
 */
function getTestEnvironmentVariables(): string[] {
  return Object.keys(process.env).filter(isTestEnvironmentVariable)
}

/**
 * Clean up all WEBSSH2_ and PORT environment variables
 * Should be called in beforeEach/afterEach hooks across all test files
 */
export function cleanupEnvironmentVariables(): void {
  for (const key of getTestEnvironmentVariables()) {
    delete process.env[key]
  }
}

/**
 * Store current environment variables for later restoration
 * @returns Map of environment variables to restore
 */
export function storeEnvironmentVariables(): TestEnvironment {
  const originalEnv: TestEnvironment = {}
  for (const key of getTestEnvironmentVariables()) {
    originalEnv[key] = process.env[key]
  }
  return originalEnv
}

/**
 * Restore environment variables from stored state
 * @param originalEnv - Map of environment variables to restore
 */
export function restoreEnvironmentVariables(originalEnv: TestEnvironment): void {
  // First clean up current env vars
  cleanupEnvironmentVariables()

  // Then restore original values
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) {
      process.env[key] = value
    }
  }
}

// =============================================================================
// Socket.IO Mock Helpers
// =============================================================================

export interface MockSocketOptions {
  id?: string
  sessionCredentials?: {
    host?: string
    port?: number
    username?: string
    password?: string
    term?: string
  } | null
  usedBasicAuth?: boolean
  authMethod?: string
}

export interface MockSSHConnectionOptions {
  withExecMethods?: boolean
  connectResolves?: boolean
  shellResolves?: boolean
}

/**
 * Create a mock Socket.IO server instance
 */
export function createMockIO(): unknown {
  const io: unknown = new EventEmitter()
  io.on = vi.fn(io.on)
  return io
}

/**
 * Create a mock Socket instance with standard test configuration
 */
export function createMockSocket(options: MockSocketOptions = {}): unknown {
  const mockSocket: unknown = new EventEmitter()
  mockSocket.id = options.id ?? 'test-socket-id'
  mockSocket.request = {
    session: {
      save: vi.fn((cb: () => void) => cb()),
      sshCredentials: options.sessionCredentials ?? null,
      usedBasicAuth: options.usedBasicAuth ?? false,
      authMethod: options.authMethod,
    },
  }
  mockSocket.emit = vi.fn()
  mockSocket.disconnect = vi.fn()
  mockSocket.onAny = vi.fn()
  mockSocket.offAny = vi.fn()
  return mockSocket
}

/**
 * Create a mock SSH Connection class for testing
 */
export function createMockSSHConnection(options: MockSSHConnectionOptions = {}): unknown {
  if (options.withExecMethods) {
    return class extends EventEmitter {
      connect() {
        return options.connectResolves === false ? Promise.reject(new Error('Connection failed')) : Promise.resolve()
      }
      shell() {
        return options.shellResolves === false ? Promise.reject(new Error('Shell failed')) : Promise.resolve(new EventEmitter())
      }
      exec(command: string, _options: unknown, _envVars: unknown) {
        const stream: unknown = new EventEmitter()
        stream.stderr = new EventEmitter()
        process.nextTick(() => {
          stream.emit('data', Buffer.from(`OUT:${command}`))
          stream.stderr.emit('data', Buffer.from('ERR:warn'))
          stream.emit('close', 0, null)
        })
        return Promise.resolve(stream)
      }
      end(): void {
        // no-op - mock connection cleanup
      }
    }
  }
  return class extends EventEmitter {}
}

/**
 * Create a standard mock config object for socket tests
 */
export function createMockSocketConfig(overrides: Record<string, any> = {}): unknown {
  return {
    ssh: {
      term: DEFAULTS.SSH_TERM,
      readyTimeout: DEFAULTS.SSH_READY_TIMEOUT_MS,
      keepaliveInterval: DEFAULTS.SSH_KEEPALIVE_INTERVAL_MS,
      keepaliveCountMax: DEFAULTS.SSH_KEEPALIVE_COUNT_MAX,
      disableInteractiveAuth: false,
      alwaysSendKeyboardInteractivePrompts: false,
      algorithms: {
        kex: ['ecdh-sha2-nistp256', 'diffie-hellman-group14-sha1'],
        cipher: ['aes128-ctr', 'aes256-ctr'],
        serverHostKey: ['ssh-rsa', 'ssh-ed25519'],
        hmac: ['hmac-sha2-256', 'hmac-sha1'],
        compress: ['none']
      },
      allowedAuthMethods: DEFAULT_AUTH_METHODS.map(createAuthMethod),
      hostKeyVerification: {
        enabled: false,
        mode: 'hybrid',
        unknownKeyAction: 'prompt',
        serverStore: { enabled: false, dbPath: ':memory:' },
        clientStore: { enabled: false },
      },
      ...overrides.ssh,
    },
    options: {
      allowReauth: true,
      allowReplay: true,
      allowReconnect: true,
      autoLog: false,
      ...overrides.options,
    },
    user: overrides.user ?? {},
    header: overrides.header ?? null,
  }
}

// =============================================================================
// Config File Management Helpers
// =============================================================================

export interface ConfigFileManager {
  configPath: string
  backupPath: string
  setup(): void
  cleanup(): void
  writeConfig(config: unknown): void
  configExists(): boolean
}

/**
 * Create a config file manager for test isolation
 */
export function createConfigFileManager(configFileName = 'config.json'): ConfigFileManager {
  const configPath = path.join(process.cwd(), configFileName)
  const backupPath = `${configPath}.backup`

  return {
    configPath,
    backupPath,

    setup(): void {
      // Backup existing config if it exists
      if (fs.existsSync(configPath)) {
        fs.copyFileSync(configPath, backupPath)
      }
    },

    cleanup(): void {
      // Restore original config or clean up test config
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, configPath)
        fs.unlinkSync(backupPath)
      } else if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath)
      }
    },

    writeConfig(config: unknown): void {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    },

    configExists(): boolean {
      return fs.existsSync(configPath)
    }
  }
}

/**
 * Standard test environment setup combining env vars and config files
 */
export function setupTestEnvironment(options: { withConfigFile?: boolean } = {}): {
  originalEnv: TestEnvironment
  configManager?: ConfigFileManager
  cleanup: () => void
} {
  const originalEnv = storeEnvironmentVariables()
  cleanupEnvironmentVariables()

  let configManager: ConfigFileManager | undefined

  if (options.withConfigFile) {
    configManager = createConfigFileManager()
    configManager.setup()
  }

  return {
    originalEnv,
    configManager,
    cleanup: () => {
      restoreEnvironmentVariables(originalEnv)
      if (configManager) {
        configManager.cleanup()
      }
    }
  }
}

// ============================================================================
// Result Type Test Helpers
// ============================================================================

/**
 * Test helper functions for Result type utilities.
 * These functions are only used in tests and not in production code.
 * They provide functional programming utilities for working with Result types.
 */

/**
 * Check if result is success
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok === true
}

/**
 * Map success value to new value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value))
  }
  return result
}

/**
 * Map error to new error
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error))
  }
  return result
}

/**
 * Chain operations that return Results
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value)
  }
  return result
}

/**
 * Provide alternative value on error
 */
export function orElse<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> {
  if (isErr(result)) {
    return fn(result.error)
  }
  return result
}

/**
 * Unwrap value or throw error
 * Use only when error is truly exceptional
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value
  }
  throw new Error(`Result unwrap failed: ${JSON.stringify(result.error)}`)
}

/**
 * Unwrap value or return default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value
  }
  return defaultValue
}

/**
 * Unwrap value or compute default
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (isOk(result)) {
    return result.value
  }
  return fn(result.error)
}

/**
 * Convert Result to nullable value
 */
export function toNullable<T, E>(result: Result<T, E>): T | null {
  if (isOk(result)) {
    return result.value
  }
  return null
}

/**
 * Create Result from nullable value
 */
export function fromNullable<T, E>(
  value: T | null | undefined,
  error: E
): Result<T, E> {
  if (value != null) {
    return ok(value)
  }
  return err(error)
}

/**
 * Try to execute function and catch errors
 */
export function tryCatch<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn())
  } catch (error) {
    if (mapError != null) {
      return err(mapError(error))
    }
    return err(error as E)
  }
}

/**
 * Try to execute async function and catch errors
 */
export async function tryCatchAsync<T, E = Error>(
  fn: () => Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await fn()
    return ok(value)
  } catch (error) {
    if (mapError != null) {
      return err(mapError(error))
    }
    return err(error as E)
  }
}

/**
 * Combine multiple Results into single Result of array
 */
export function combine<T, E>(results: Array<Result<T, E>>): Result<T[], E> {
  const values: T[] = []

  for (const result of results) {
    if (isErr(result)) {
      return result
    }
    values.push(result.value)
  }

  return ok(values)
}

/**
 * Combine multiple Results, collecting all errors
 */
export function combineAll<T, E>(
  results: Array<Result<T, E>>
): Result<T[], E[]> {
  const values: T[] = []
  const errors: E[] = []

  for (const result of results) {
    if (isOk(result)) {
      values.push(result.value)
    } else {
      errors.push(result.error)
    }
  }

  if (errors.length > 0) {
    return err(errors)
  }

  return ok(values)
}
