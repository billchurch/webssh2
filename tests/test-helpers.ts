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

export interface MockSocket {
  id: string
  request: {
    session: {
      save: ReturnType<typeof mock.fn>
      sshCredentials: MockSocketOptions['sessionCredentials']
      usedBasicAuth: boolean
      authMethod?: string
    }
  }
  on: ReturnType<typeof mock.fn>
  once: ReturnType<typeof mock.fn>
  emit: ReturnType<typeof mock.fn>
  disconnect: ReturnType<typeof mock.fn>
}

/**
 * Create a mock Socket instance with standard test configuration
 */
export function createMockSocket(options: MockSocketOptions = {}): MockSocket {
  const baseEmitter = new EventEmitter()
  const mockSocket: MockSocket = {
    id: options.id ?? 'test-socket-id',
    request: {
      session: {
        save: mock.fn((cb: () => void) => cb()),
        sshCredentials: options.sessionCredentials ?? null,
        usedBasicAuth: options.usedBasicAuth ?? false,
        authMethod: options.authMethod,
      },
    },
    on: mock.fn(baseEmitter.on.bind(baseEmitter)),
    once: mock.fn(baseEmitter.once.bind(baseEmitter)),
    emit: mock.fn(),
    disconnect: mock.fn(),
  }
  return mockSocket
}

interface MockStream extends EventEmitter {
  stderr: EventEmitter
}

/**
 * Create a mock SSH Connection class for testing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Mock returns class constructor with dynamic methods
export function createMockSSHConnection(options: MockSSHConnectionOptions = {}): any {
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

// =============================================================================
// SSH Server Helpers (for ssh.test.ts migration)
// =============================================================================

import ssh2 from 'ssh2'
import type { Server as SSH2Server, AuthContext, Session, ClientChannel } from 'ssh2'

const { Server: SSH2ServerClass } = ssh2

export interface SSHCredentials {
  username: string
  password: string
}

export interface SSHServerOptions {
  allowPasswordAuth?: boolean
  allowPublicKeyAuth?: boolean
  allowedUsername?: string
  privateKeyFormat?: 'openssh' | 'rsa' | 'ec'
}

interface SSHHandlers {
  handlePty: (acceptPty: () => void) => void
  handleShell: (acceptShell: () => ClientChannel) => void
  handleSession: (accept: () => Session) => void
}

function createSSHHandlers(shellMessage: string): SSHHandlers {
  const handlePty = (acceptPty: () => void): void => {
    acceptPty()
  }

  const handleShell = (acceptShell: () => ClientChannel): void => {
    const stream = acceptShell()
    stream.write(shellMessage)
  }

  const handleSession = (accept: () => Session): void => {
    const session = accept()
    session.once('pty', handlePty)
    session.once('shell', handleShell)
  }

  return { handlePty, handleShell, handleSession }
}

export function createBasicSSHServer(
  hostPrivateKey: string,
  credentials: SSHCredentials,
  options: SSHServerOptions = {}
): SSH2Server {
  const handleAuthentication = (ctx: AuthContext): void => {
    if (options.allowPasswordAuth === false) {
      ctx.reject()
      return
    }

    if (
      ctx.method === 'password' &&
      ctx.username === credentials.username &&
      ctx.password === credentials.password
    ) {
      ctx.accept()
    } else {
      ctx.reject()
    }
  }

  const { handleSession } = createSSHHandlers('Connected to test server\r\n')

  const handleClientReady = (client: ssh2.Connection): void => {
    client.on('session', handleSession)
  }

  const handleClientConnection = (client: ssh2.Connection): void => {
    client.on('authentication', handleAuthentication)
    client.on('ready', () => handleClientReady(client))
  }

  return new SSH2ServerClass({ hostKeys: [hostPrivateKey] }, handleClientConnection)
}

export function createSSHServerWithPrivateKey(
  hostPrivateKey: string,
  username: string,
  clientPublicKey?: string
): SSH2Server {
  const handleAuthentication = (ctx: AuthContext): void => {
    if (ctx.method === 'publickey' && ctx.username === username) {
      if (clientPublicKey === undefined || ctx.key.data.equals(Buffer.from(clientPublicKey))) {
        ctx.accept()
      } else {
        ctx.reject()
      }
    } else {
      ctx.reject()
    }
  }

  const { handleSession } = createSSHHandlers('Connected via private key\r\n')

  const handleClientReady = (client: ssh2.Connection): void => {
    client.on('session', handleSession)
  }

  const handleClientConnection = (client: ssh2.Connection): void => {
    client.on('authentication', handleAuthentication)
    client.on('ready', () => handleClientReady(client))
  }

  return new SSH2ServerClass({ hostKeys: [hostPrivateKey] }, handleClientConnection)
}

export function createSSHServerWithExec(
  hostPrivateKey: string,
  credentials: SSHCredentials,
  execHandler?: (command: string, stream: ClientChannel) => void
): SSH2Server {
  const handleAuthentication = (ctx: AuthContext): void => {
    if (
      ctx.method === 'password' &&
      ctx.username === credentials.username &&
      ctx.password === credentials.password
    ) {
      ctx.accept()
    } else {
      ctx.reject()
    }
  }

  const handleExec = (accept: (usePTY?: boolean) => ClientChannel, _reject: () => boolean, info: { command: string }): void => {
    const stream = accept()
    if (execHandler === undefined) {
      stream.write(`Command output: ${info.command}\r\n`)
      stream.exit(0)
      stream.end()
    } else {
      execHandler(info.command, stream)
    }
  }

  const { handlePty, handleShell } = createSSHHandlers('Connected to test server with exec support\r\n')

  const handleSession = (accept: () => Session): void => {
    const session = accept()
    session.once('pty', handlePty)
    session.once('shell', handleShell)
    session.once('exec', handleExec)
  }

  const handleClientReady = (client: ssh2.Connection): void => {
    client.on('session', handleSession)
  }

  const handleClientConnection = (client: ssh2.Connection): void => {
    client.on('authentication', handleAuthentication)
    client.on('ready', () => handleClientReady(client))
  }

  return new SSH2ServerClass({ hostKeys: [hostPrivateKey] }, handleClientConnection)
}

export function createSSHServerWithPTY(
  hostPrivateKey: string,
  credentials: SSHCredentials
): SSH2Server {
  return createBasicSSHServer(hostPrivateKey, credentials)
}

export async function withSSHServerCleanup(
  server: SSH2Server,
  connection: { end: () => void }
): Promise<void> {
  connection.end()
  return new Promise((resolve) => {
    server.close(resolve as () => void)
  })
}

// =============================================================================
// Credential Builder Helpers
// =============================================================================

import { TEST_USERNAME, TEST_PASSWORD, TEST_SSH, INVALID_USERNAME, INVALID_PASSWORD, TEST_SECRET } from './test-constants.js'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface Credentials {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  passphrase?: string
}

export function buildTestCredentials(overrides?: Partial<Credentials>): Credentials {
  return {
    host: TEST_SSH.HOST,
    port: TEST_SSH.PORT,
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    ...overrides
  }
}

export function buildInvalidCredentials(overrides?: Partial<Credentials>): Credentials {
  return {
    host: TEST_SSH.HOST,
    port: TEST_SSH.PORT,
    username: INVALID_USERNAME,
    password: INVALID_PASSWORD,
    ...overrides
  }
}

// =============================================================================
// Socket Event Helpers (for contract test migration)
// =============================================================================

export interface MockCall {
  arguments: [string, unknown]
}

export function findSocketEvent(
  mockCalls: MockCall[],
  eventName: string
): MockCall | undefined {
  return mockCalls.find((call) => call.arguments[0] === eventName)
}

export function findAllSocketEvents(
  mockCalls: MockCall[],
  eventName: string
): MockCall[] {
  return mockCalls.filter((call) => call.arguments[0] === eventName)
}

export function expectSocketEvent(
  mockCalls: MockCall[],
  eventName: string,
  payload?: unknown
): void {
  const event = findSocketEvent(mockCalls, eventName)
  if (event === undefined) {
    throw new Error(`Expected socket event '${eventName}' not found`)
  }
  if (payload !== undefined) {
    const actualPayload = event.arguments[1]
    if (JSON.stringify(actualPayload) !== JSON.stringify(payload)) {
      throw new Error(
        `Socket event '${eventName}' payload mismatch.\nExpected: ${JSON.stringify(payload)}\nActual: ${JSON.stringify(actualPayload)}`
      )
    }
  }
}

export function expectAuthSuccess(
  mockCalls: MockCall[],
  expectedPermissions?: string[]
): void {
  const authEvents = findAllSocketEvents(mockCalls, 'authentication')
  if (authEvents.length === 0) {
    throw new Error('Expected authentication event not found')
  }

  const lastAuth = authEvents.at(-1)!.arguments[1] as { success?: boolean }
  if (lastAuth.success !== true) {
    throw new Error('Expected authentication success')
  }

  if (expectedPermissions !== undefined) {
    const permissionsEvent = findSocketEvent(mockCalls, 'permissions')
    if (permissionsEvent === undefined) {
      throw new Error('Expected permissions event not found')
    }
    const actualPermissions = permissionsEvent.arguments[1] as string[]
    if (JSON.stringify(actualPermissions) !== JSON.stringify(expectedPermissions)) {
      throw new Error(`Permissions mismatch.\nExpected: ${JSON.stringify(expectedPermissions)}\nActual: ${JSON.stringify(actualPermissions)}`)
    }
  }
}

export function expectAuthFailure(
  mockCalls: MockCall[],
  messagePattern?: RegExp
): void {
  const authEvents = findAllSocketEvents(mockCalls, 'authentication')
  if (authEvents.length === 0) {
    throw new Error('Expected authentication event not found')
  }

  const lastAuth = authEvents.at(-1)!.arguments[1] as { success?: boolean; message?: string }
  if (lastAuth.success !== false) {
    throw new Error('Expected authentication failure')
  }

  if (messagePattern !== undefined && lastAuth.message !== undefined) {
    if (!messagePattern.test(lastAuth.message)) {
      throw new Error(`Auth failure message '${lastAuth.message}' does not match pattern ${messagePattern}`)
    }
  }
}

// =============================================================================
// Config Builder Helpers
// =============================================================================

export interface TestConfig {
  ssh: {
    host: string
    port: number
    term: string
    readyTimeout: number
    keepaliveInterval: number
    keepaliveCountMax: number
  }
  user: {
    name: string | null
    password: string | null
    privateKey: string | null
  }
  session: {
    secret: string
    name: string
  }
  sso: {
    enabled: boolean
    csrfProtection: boolean
    trustedProxies: string[]
    headerMapping: Record<string, string>
  }
  options: {
    challengeButton: boolean
    allowReauth: boolean
    allowReplay: boolean
  }
}

export function createMinimalConfig(overrides?: DeepPartial<TestConfig>): TestConfig {
  const base: TestConfig = {
    ssh: {
      host: TEST_SSH.HOST,
      port: TEST_SSH.PORT,
      term: 'xterm-256color',
      readyTimeout: 20000,
      keepaliveInterval: 120000,
      keepaliveCountMax: 10,
    },
    user: {
      name: null,
      password: null,
      privateKey: null,
    },
    session: {
      secret: TEST_SECRET,
      name: 'webssh2.sid',
    },
    sso: {
      enabled: false,
      csrfProtection: false,
      trustedProxies: [],
      headerMapping: {},
    },
    options: {
      challengeButton: false,
      allowReauth: true,
      allowReplay: true,
    },
  }

  return overrides === undefined ? base : deepMergeConfigs(base, overrides)
}

export function createTestConfigWithSSO(
  enabled: boolean,
  headers?: Record<string, string>
): TestConfig {
  return createMinimalConfig({
    sso: {
      enabled,
      headerMapping: headers ?? {},
    },
  })
}

export function createSSHTestConfig(
  host: string,
  port: number,
  overrides?: Partial<TestConfig['ssh']>
): TestConfig['ssh'] {
  return {
    host,
    port,
    term: 'xterm-256color',
    readyTimeout: 20000,
    keepaliveInterval: 120000,
    keepaliveCountMax: 10,
    ...overrides,
  }
}

function deepMergeConfigs<T>(target: T, source: DeepPartial<T>): T {
  const result = { ...target }
  for (const key in source) {
    // eslint-disable-next-line security/detect-object-injection
    const sourceValue = source[key]
    if (sourceValue !== undefined && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      // eslint-disable-next-line security/detect-object-injection
      result[key] = deepMergeConfigs(result[key] as unknown, sourceValue) as T[Extract<keyof T, string>]
    } else if (sourceValue !== undefined) {
      // eslint-disable-next-line security/detect-object-injection
      result[key] = sourceValue as T[Extract<keyof T, string>]
    }
  }
  return result
}