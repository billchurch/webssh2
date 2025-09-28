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
import type { TestEnvironment, AuthStatus } from './types/index.js'
import { TEST_USERNAME, TEST_SSH, TEST_SECRET } from './test-constants.js'
import { DEFAULTS } from '../app/constants.js'

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
          ? { ok: true, value: { id: 'test-conn-id', sessionId: 'test-session', status: 'connected', createdAt: Date.now(), lastActivity: Date.now() } }
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
    }
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
  states.forEach((state) => {
    mockObj.mockReturnValueOnce(state)
  })
  if (states.length > 0) {
    mockObj.mockReturnValue(states[states.length - 1])
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
  getTestEnvironmentVariables().forEach(key => {
    delete process.env[key]
  })
}

/**
 * Store current environment variables for later restoration
 * @returns Map of environment variables to restore
 */
export function storeEnvironmentVariables(): TestEnvironment {
  const originalEnv: TestEnvironment = {}
  getTestEnvironmentVariables().forEach(key => {
    originalEnv[key] = process.env[key]
  })
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
  Object.entries(originalEnv).forEach(([key, value]) => {
    if (value !== undefined) {
      process.env[key] = value
    }
  })
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
        cipher: [],
        compress: [],
        hmac: []
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