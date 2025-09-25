// tests/test-helpers.ts

import { EventEmitter } from 'node:events'
import { mock } from 'node:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { TestEnvironment } from './types/index.js'

/**
 * Clean up all WEBSSH2_ and PORT environment variables
 * Should be called in beforeEach/afterEach hooks across all test files
 */
export function cleanupEnvironmentVariables(): void {
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('WEBSSH2_') || key === 'PORT') {
      // eslint-disable-next-line security/detect-object-injection
      delete process.env[key] // Safe: only deleting specific env vars
    }
  })
}

/**
 * Global cleanup function for test file module imports
 */
function cleanupEnvironmentVariablesGlobal(): void {
  cleanupEnvironmentVariables()
}

// Global cleanup - runs when module is imported
cleanupEnvironmentVariablesGlobal()

/**
 * Store current environment variables for later restoration
 * @returns Map of environment variables to restore
 */
export function storeEnvironmentVariables(): TestEnvironment {
  const originalEnv: TestEnvironment = {}
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('WEBSSH2_') || key === 'PORT') {
      // eslint-disable-next-line security/detect-object-injection
      originalEnv[key] = process.env[key] // Safe: only reading specific env vars
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
    // eslint-disable-next-line security/detect-object-injection
    const value = originalEnv[key]
    if (value !== undefined) {
      // eslint-disable-next-line security/detect-object-injection
      process.env[key] = value // Safe: restoring only previously stored env vars
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
export function createMockIO(): EventEmitter & { on: ReturnType<typeof mock.fn> } {
  const io = new EventEmitter() as EventEmitter & { on: ReturnType<typeof mock.fn> }
  io.on = mock.fn(io.on)
  return io
}

interface MockSocket extends EventEmitter {
  id: string
  request: {
    session: {
      save: ReturnType<typeof mock.fn>
      sshCredentials: MockSocketOptions['sessionCredentials']
      usedBasicAuth: boolean
      authMethod?: string
    }
  }
  emit: ReturnType<typeof mock.fn>
  disconnect: ReturnType<typeof mock.fn>
}

/**
 * Create a mock Socket instance with standard test configuration
 */
export function createMockSocket(options: MockSocketOptions = {}): MockSocket {
  const mockSocket = new EventEmitter() as MockSocket
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

interface MockStream extends EventEmitter {
  stderr: EventEmitter
}

/**
 * Create a mock SSH Connection class for testing
 */
export function createMockSSHConnection(options: MockSSHConnectionOptions = {}): typeof EventEmitter {
  if (options.withExecMethods !== undefined && options.withExecMethods) {
    return class extends EventEmitter {
      connect(): Promise<void> {
        return options.connectResolves !== false ? Promise.resolve() : Promise.reject(new Error('Connection failed'))
      }
      shell(): Promise<EventEmitter> {
        return options.shellResolves !== false ? Promise.resolve(new EventEmitter()) : Promise.reject(new Error('Shell failed'))
      }
      exec(command: string, _options: unknown, _envVars: unknown): MockStream {
        const stream = new EventEmitter() as MockStream
        stream.stderr = new EventEmitter()
        process.nextTick(() => {
          stream.emit('data', Buffer.from(`OUT:${command}`))
          stream.stderr.emit('data', Buffer.from('ERR:warn'))
          stream.emit('close', 0, null)
        })
        return stream
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
export function createMockSocketConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ssh: {
      term: 'xterm-color',
      readyTimeout: 20000,
      keepaliveInterval: 120000,
      keepaliveCountMax: 10,
      disableInteractiveAuth: false,
      ...(overrides.ssh as Record<string, unknown>),
    },
    options: {
      allowReauth: true,
      allowReplay: true,
      allowReconnect: true,
      ...(overrides.options as Record<string, unknown>),
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
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(configPath)) {
        fs.copyFileSync(configPath, backupPath)
      }
    },

    cleanup(): void {
      // Restore original config or clean up test config
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, configPath)
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.unlinkSync(backupPath)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      } else if (fs.existsSync(configPath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.unlinkSync(configPath)
      }
    },

    writeConfig(config: unknown): void {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    },

    configExists(): boolean {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
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
  
  if (options.withConfigFile === true) {
    configManager = createConfigFileManager()
    configManager.setup()
  }
  
  return {
    originalEnv,
    configManager,
    cleanup: () => {
      restoreEnvironmentVariables(originalEnv)
      if (configManager !== undefined) {
        configManager.cleanup()
      }
    }
  }
}