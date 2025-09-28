/**
 * Unit tests for SSHService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { SSHServiceImpl } from '../../../app/services/ssh/ssh-service.js'
import type { SSHConfig, ShellOptions, SSHConnection } from '../../../app/services/interfaces.js'
import { createSessionId, createConnectionId } from '../../../app/types/branded.js'
import { Client as SSH2Client } from 'ssh2'
import { TEST_USERNAME, TEST_PASSWORD, TEST_SSH } from '../../test-constants.js'
import { createMockStore, createMockDependencies } from '../../test-utils.js'
import { Duplex } from 'node:stream'

// Factory function to create mock SSH2 client
const createMockClient = () => {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  return {
    connect: vi.fn(),
    shell: vi.fn(),
    exec: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const eventHandlers = handlers.get(event) ?? []
      eventHandlers.push(handler)
      handlers.set(event, eventHandlers)
      return undefined
    }),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => {
      const eventHandlers = handlers.get(event) ?? []
      for (const handler of eventHandlers) {
        handler(...args)
      }
    },
    _handlers: handlers,
  }
}

// Mock SSH2 Client
vi.mock('ssh2', () => ({
  Client: vi.fn(() => createMockClient()),
}))

// Helper functions defined outside describe block to reduce nesting
const createTestSSHConfig = (overrides?: Partial<SSHConfig>): SSHConfig => ({
  sessionId: createSessionId('test-session'),
  host: TEST_SSH.HOST,
  port: TEST_SSH.PORT,
  username: TEST_USERNAME,
  password: TEST_PASSWORD,
  readyTimeout: 20000,
  keepaliveInterval: 30000,
  ...overrides,
})

// Helper to trigger events on mock client
interface MockClientWithTrigger {
  _trigger: (event: string, ...args: unknown[]) => void
  connect: Mock
  shell: Mock
  exec: Mock
  end: Mock
  on: Mock
}

const triggerClientEvent = (client: unknown, event: string, ...args: unknown[]): void => {
  const mockClient = client as MockClientWithTrigger
  mockClient._trigger(event, ...args)
}

const createShellCallback =
  (stream: Duplex | null, error?: Error) =>
  (_ptyOpts: unknown, _envOpts: unknown, callback: (...args: unknown[]) => void): void => {
    callback(error ?? undefined, stream)
  }

const createExecCallback =
  (mockStream: unknown, error?: Error) =>
  (_cmd: string, callback: (...args: unknown[]) => void): void => {
    callback(error ?? undefined, mockStream)
  }

// Mock stream factory
interface MockExecStream {
  on: ReturnType<typeof vi.fn>
  stderr: { on: ReturnType<typeof vi.fn> }
}

const createMockExecStream = (
  stdout: string,
  exitCode: number = 0,
): MockExecStream => ({
  on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
    if (event === 'data') {
      setTimeout(() => handler(Buffer.from(stdout)), 0)
    }
    if (event === 'close') {
      setTimeout(() => handler(exitCode), 10)
    }
    return createMockExecStream(stdout, exitCode)
  }),
  stderr: { on: vi.fn() },
})

describe('SSHService', () => {
  let sshService: SSHServiceImpl
  let mockDeps: ReturnType<typeof createMockDependencies>
  let mockStore: ReturnType<typeof createMockStore>
  let mockClient: unknown

  // Helper function to trigger successful connection
  const triggerSuccessfulConnection = async (): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 0))
    triggerClientEvent(mockClient, 'ready')
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  // Helper function to establish a test connection
  const establishTestConnection = async (
    configOverrides?: Partial<SSHConfig>,
  ): Promise<{ config: SSHConfig; connection: SSHConnection }> => {
    const config = createTestSSHConfig(configOverrides)
    const connectPromise = sshService.connect(config)
    await triggerSuccessfulConnection()
    const result = await connectPromise
    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Failed to establish connection')
    }
    return { config, connection: result.value }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockStore = createMockStore()
    mockDeps = createMockDependencies()

    // Create mock client with event handling capability
    mockClient = createMockClient()
    ;(SSH2Client as unknown as Mock).mockReturnValue(mockClient)

    sshService = new SSHServiceImpl(mockDeps, mockStore)
  })

  describe('connect', () => {
    it('should establish SSH connection with password', async () => {
      const config = createTestSSHConfig()

      const resultPromise = sshService.connect(config)
      await triggerSuccessfulConnection()
      const result = await resultPromise

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveProperty('id')
        expect(result.value).toHaveProperty('sessionId', config.sessionId)
        expect(result.value).toHaveProperty('client')
        expect(result.value.status).toBe('connected')
      }

      expect((mockClient as { connect: Mock }).connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: TEST_SSH.HOST,
          port: TEST_SSH.PORT,
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
        }),
      )

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        config.sessionId,
        expect.objectContaining({
          type: 'CONNECTION_ESTABLISHED',
        }),
      )
    })

    it('should handle connection with private key', async () => {
      const privateKey = '-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----'
      const config = createTestSSHConfig({ privateKey, password: undefined })

      const connectPromise = sshService.connect(config)
      await triggerSuccessfulConnection()
      const result = await connectPromise

      expect(result.ok).toBe(true)
      expect((mockClient as { connect: Mock }).connect).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey,
        }),
      )
    })

    it('should handle connection errors', async () => {
      const config = createTestSSHConfig()
      const error = new Error('Connection refused')

      const connectPromise = sshService.connect(config)
      await new Promise(resolve => setTimeout(resolve, 0))
      triggerClientEvent(mockClient, 'error', error)
      await new Promise(resolve => setTimeout(resolve, 0))
      const result = await connectPromise

      expect(result.ok).toBe(false)
      if (result.ok === false) {
        expect(result.error.message).toContain('Connection refused')
      }

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        config.sessionId,
        expect.objectContaining({
          type: 'CONNECTION_ERROR',
        }),
      )
    })
  })

  describe('shell', () => {
    it('should open shell stream', async () => {
      const options: ShellOptions = {
        term: 'xterm-256color',
        rows: 24,
        cols: 80,
        env: { LANG: 'en_US.UTF-8' },
      }

      const { connection } = await establishTestConnection()

      const mockStream = new Duplex()
      const client = mockClient as { shell: Mock }
      client.shell.mockImplementation(
        createShellCallback(mockStream),
      )

      const shellResult = await sshService.shell(connection.id, options)

      expect(shellResult.ok).toBe(true)
      if (shellResult.ok) {
        expect(shellResult.value).toBe(mockStream)
      }

      expect((mockClient as { shell: Mock }).shell).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'xterm-256color',
          rows: 24,
          cols: 80,
        }),
        expect.objectContaining({
          env: { LANG: 'en_US.UTF-8' },
        }),
        expect.any(Function),
      )
    })

    it('should handle shell errors', async () => {
      const options: ShellOptions = {
        term: 'xterm-256color',
        rows: 24,
        cols: 80,
      }

      const { connection } = await establishTestConnection()

      const error = new Error('Shell access denied')
      const client = mockClient as { shell: Mock }
      client.shell.mockImplementation(
        createShellCallback(null, error),
      )

      const shellResult = await sshService.shell(connection.id, options)

      expect(shellResult.ok).toBe(false)
      if (shellResult.ok === false) {
        expect(shellResult.error.message).toContain('Shell access denied')
      }
    })
  })

  describe('exec', () => {
    it('should execute command', async () => {
      const command = 'ls -la'

      const { connection } = await establishTestConnection()

      const mockStream = createMockExecStream(
        'file1.txt\nfile2.txt\n',
        0,
      )
      const client = mockClient as { exec: Mock }
      client.exec.mockImplementation(createExecCallback(mockStream))

      const execResult = await sshService.exec(connection.id, command)

      expect(execResult.ok).toBe(true)
      if (execResult.ok) {
        expect(execResult.value.stdout).toContain('file1.txt')
        expect(execResult.value.code).toBe(0)
      }

      expect((mockClient as { exec: Mock }).exec).toHaveBeenCalledWith(command, expect.any(Function))
    })
  })

  describe('disconnect', () => {
    it('should close connection', async () => {
      const { connection } = await establishTestConnection()

      const disconnectResult = await sshService.disconnect(connection.id)

      expect(disconnectResult.ok).toBe(true)
      expect((mockClient as { end: Mock }).end).toHaveBeenCalled()
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        connection.sessionId,
        expect.objectContaining({
          type: 'CONNECTION_CLOSED',
        }),
      )
    })

    it('should handle non-existent connection', async () => {
      const connectionId = createConnectionId('non-existent')
      const result = await sshService.disconnect(connectionId)

      expect(result.ok).toBe(true) // Returns ok even if connection doesn't exist
      expect((mockClient as { end: Mock }).end).not.toHaveBeenCalled()
    })
  })

  describe('getConnectionStatus', () => {
    it('should return connection status', async () => {
      const { connection } = await establishTestConnection()

      const statusResult = sshService.getConnectionStatus(connection.id)

      expect(statusResult.ok).toBe(true)
      if (statusResult.ok && statusResult.value !== null) {
        expect(statusResult.value.status).toBe('connected')
      }
    })

    it('should return null for non-existent connection', () => {
      const connectionId = createConnectionId('non-existent')
      const result = sshService.getConnectionStatus(connectionId)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeNull()
      }
    })
  })

  describe('disconnectSession', () => {
    it('should disconnect all connections for a session', async () => {
      const sessionId = createSessionId('test-session')

      await establishTestConnection({ sessionId })
      await sshService.disconnectSession(sessionId)

      expect((mockClient as { end: Mock }).end).toHaveBeenCalled()
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'CONNECTION_CLOSED',
        }),
      )
    })
  })
})
