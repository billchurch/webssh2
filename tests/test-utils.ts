/**
 * Consolidated test utilities for all test files
 * Combines utilities from test-utils.ts and test-helpers.ts
 */

import { EventEmitter } from 'node:events'
import { mock } from 'node:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SessionStore } from '../app/state/store.js'
import type { ServiceDependencies } from '../app/services/interfaces.js'
import type { TestEnvironment } from './types/index.js'
import { TEST_USERNAME, TEST_SSH, TEST_PASSWORDS, TEST_SECRET } from './test-constants.js'
import { DEFAULTS } from '../app/constants.js'

// Dynamic import for vitest when available
let vi: any
let Mock: any
try {
  const vitest = await import('vitest')
  vi = vitest.vi
  Mock = vitest.Mock
} catch {
  // vitest not available - we're in node test runner mode
  vi = null
  Mock = null
}

/**
 * Creates a mock SessionStore for testing
 */
export function createMockStore(): SessionStore {
  if (vi) {
    // Vitest environment
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
  } else {
    // Node test environment
    return {
      dispatch: mock.fn(),
      getState: mock.fn(),
      createSession: mock.fn(),
      removeSession: mock.fn(),
      getSessionIds: mock.fn(() => []),
      hasSession: mock.fn(() => false),
      getHistory: mock.fn(() => []),
      clear: mock.fn(),
      subscribe: mock.fn()
    } as unknown as SessionStore
  }
}

/**
 * Creates mock ServiceDependencies for testing
 */
export function createMockDependencies(): ServiceDependencies {
  const mockFn = vi ? vi.fn : mock.fn
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
      debug: mockFn(),
      info: mockFn(),
      warn: mockFn(),
      error: mockFn()
    }
  }
}

/**
 * Creates a mock SSH2 client for testing
 */
export function createMockSSH2Client(): any {
  const mockFn = vi ? vi.fn : mock.fn
  return {
    connect: mockFn(),
    shell: mockFn(),
    exec: mockFn(),
    end: mockFn(),
    on: mockFn(),
    once: mockFn(),
    removeAllListeners: mockFn()
  }
}

/**
 * Creates a standard auth state for testing
 */
export function createAuthState(status: 'pending' | 'authenticated' | 'failed' = 'authenticated') {
  const baseState = {
    auth: {
      status,
      username: null as string | null,
      method: null as string | null,
      timestamp: Date.now(),
      errorMessage: null as string | null
    }
  }

  if (status === 'authenticated') {
    baseState.auth.username = TEST_USERNAME
    baseState.auth.method = 'manual'
  }

  return baseState
}

/**
 * Creates a standard session state for testing
 */
export function createSessionState(overrides?: {
  authStatus?: 'pending' | 'authenticated' | 'failed'
  connectionStatus?: 'idle' | 'connecting' | 'connected' | 'closed'
  terminalRows?: number
  terminalCols?: number
}) {
  const {
    authStatus = 'authenticated',
    connectionStatus = 'connected',
    terminalRows = 24,
    terminalCols = 80
  } = overrides || {}

  return {
    auth: {
      status: authStatus,
      username: authStatus === 'authenticated' ? TEST_USERNAME : null,
      method: authStatus === 'authenticated' ? 'manual' as const : null,
      timestamp: Date.now(),
      errorMessage: null
    },
    connection: {
      status: connectionStatus,
      host: connectionStatus !== 'idle' ? TEST_SSH.HOST : null,
      port: connectionStatus !== 'idle' ? TEST_SSH.PORT : null,
      connectionId: connectionStatus === 'connected' ? 'test-conn-id' : null,
      errorMessage: null
    },
    terminal: {
      terminalId: null,
      rows: terminalRows,
      cols: terminalCols,
      environment: {}
    },
    metadata: {
      createdAt: Date.now() - 1000,
      updatedAt: Date.now(),
      userId: null,
      clientIp: null,
      userAgent: null
    }
  }
}

/**
 * Helper to set up mock store state
 */
export function setupMockStoreState(mockStore: SessionStore, state: any) {
  if (vi) {
    // Vitest environment
    (mockStore.getState as any).mockReturnValue(state)
  } else if ((mockStore.getState as any).mock) {
    // Node test environment - getState is already a mock function
    const mockGetState = mockStore.getState as any
    mockGetState.mockImplementation = () => state
  } else {
    // Fallback for other test environments
    ;(mockStore as any).getState = () => state
  }
  return mockStore
}

/**
 * Helper to set up multiple mock store states (for sequential calls)
 */
export function setupMockStoreStates(mockStore: SessionStore, ...states: any[]) {
  if (Mock) {
    const mockObj = mockStore.getState as any
    states.forEach((state) => {
      mockObj.mockReturnValueOnce(state)
    })
    if (states.length > 0) {
      mockObj.mockReturnValue(states[states.length - 1])
    }
  } else {
    // Node test environment - simplified implementation
    let callIndex = 0
    const mockGetState = mockStore.getState as any
    mockGetState.mockImplementation = () => {
      const state = callIndex < states.length ? states[callIndex] : states[states.length - 1]
      callIndex++
      return state
    }
  }
  return mockStore
}

// =============================================================================
// Environment Variable Management
// =============================================================================

/**
 * Clean up all WEBSSH2_ and PORT environment variables
 * Should be called in beforeEach/afterEach hooks across all test files
 */
export function cleanupEnvironmentVariables(): void {
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('WEBSSH2_') || key === 'PORT') {
      delete process.env[key]
    }
  })
}

/**
 * Store current environment variables for later restoration
 * @returns Map of environment variables to restore
 */
export function storeEnvironmentVariables(): TestEnvironment {
  const originalEnv: TestEnvironment = {}
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('WEBSSH2_') || key === 'PORT') {
      originalEnv[key] = process.env[key]
    }
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
  Object.keys(originalEnv).forEach(key => {
    const value = originalEnv[key]
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
export function createMockIO(): any {
  const io: any = new EventEmitter()
  io.on = mock.fn(io.on)
  return io
}

/**
 * Create a mock Socket instance with standard test configuration
 */
export function createMockSocket(options: MockSocketOptions = {}): any {
  const mockSocket: any = new EventEmitter()
  mockSocket.id = options.id ?? 'test-socket-id'
  mockSocket.request = {
    session: {
      save: mock.fn((cb: () => void) => cb()),
      sshCredentials: options.sessionCredentials ?? null,
      usedBasicAuth: options.usedBasicAuth ?? false,
      authMethod: options.authMethod,
    },
  }
  mockSocket.emit = mock.fn()
  mockSocket.disconnect = mock.fn()
  return mockSocket
}

/**
 * Create a mock SSH Connection class for testing
 */
export function createMockSSHConnection(options: MockSSHConnectionOptions = {}): any {
  if (options.withExecMethods) {
    return class extends EventEmitter {
      connect() {
        return options.connectResolves !== false ? Promise.resolve() : Promise.reject(new Error('Connection failed'))
      }
      shell() {
        return options.shellResolves !== false ? Promise.resolve(new EventEmitter()) : Promise.reject(new Error('Shell failed'))
      }
      exec(command: string, _options: any, _envVars: any) {
        const stream: any = new EventEmitter()
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
export function createMockSocketConfig(overrides: Record<string, any> = {}): any {
  return {
    ssh: {
      term: DEFAULTS.SSH_TERM,
      readyTimeout: DEFAULTS.SSH_READY_TIMEOUT_MS,
      keepaliveInterval: DEFAULTS.SSH_KEEPALIVE_INTERVAL_MS,
      keepaliveCountMax: DEFAULTS.SSH_KEEPALIVE_COUNT_MAX,
      disableInteractiveAuth: false,
      ...overrides.ssh,
    },
    options: {
      allowReauth: true,
      allowReplay: true,
      allowReconnect: true,
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
  writeConfig(config: any): void
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

    writeConfig(config: any): void {
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