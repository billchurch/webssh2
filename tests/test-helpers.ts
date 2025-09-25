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
      delete process.env[key]
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
export function createMockIO(): unknown {
  const io: unknown = new EventEmitter()
  io.on = mock.fn(io.on)
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
export function createMockSSHConnection(options: MockSSHConnectionOptions = {}): unknown {
  if (options.withExecMethods) {
    return class extends EventEmitter {
      connect() {
        return options.connectResolves !== false ? Promise.resolve() : Promise.reject(new Error('Connection failed'))
      }
      shell() {
        return options.shellResolves !== false ? Promise.resolve(new EventEmitter()) : Promise.reject(new Error('Shell failed'))
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
      term: 'xterm-color',
      readyTimeout: 20000,
      keepaliveInterval: 120000,
      keepaliveCountMax: 10,
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