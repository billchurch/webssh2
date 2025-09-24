/**
 * Unit tests for SSHService
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { SSHServiceImpl } from '../../../app/services/ssh/ssh-service.js'
import type { SSHConfig, ShellOptions } from '../../../app/services/interfaces.js'
import { createSessionId, createConnectionId } from '../../../app/types/branded.js'
import { Client as SSH2Client } from 'ssh2'
import { TEST_USERNAME, TEST_PASSWORD, TEST_SSH } from '../../test-constants.js'
import { createMockStore, createMockDependencies, createMockSSH2Client } from '../../test-utils.js'
import { Duplex } from 'node:stream'

// Mock SSH2 Client
vi.mock('ssh2', () => ({
  Client: vi.fn(() => ({
    connect: vi.fn(),
    shell: vi.fn(),
    exec: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn()
  }))
}))

describe('SSHService', () => {
  let sshService: SSHServiceImpl
  let mockDeps: ReturnType<typeof createMockDependencies>
  let mockStore: ReturnType<typeof createMockStore>
  let mockClient: ReturnType<typeof createMockSSH2Client>

  // Helper function to create test SSH config
  const createTestSSHConfig = (overrides?: Partial<SSHConfig>): SSHConfig => ({
    sessionId: createSessionId('test-session'),
    host: TEST_SSH.HOST,
    port: TEST_SSH.PORT,
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
    readyTimeout: 20000,
    keepaliveInterval: 30000,
    ...overrides
  })

  // Helper function to mock successful connection
  const mockSuccessfulConnection = () => {
    mockClient.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'ready') {
        setTimeout(() => handler(), 0)
      }
      return mockClient
    })
  }

  // Helper function to establish a test connection
  const establishTestConnection = async (configOverrides?: Partial<SSHConfig>) => {
    const config = createTestSSHConfig(configOverrides)
    mockSuccessfulConnection()
    const result = await sshService.connect(config)
    expect(result.ok).toBe(true)
    return { config, result }
  }

  beforeEach(() => {
    vi.clearAllMocks()

    mockStore = createMockStore()
    mockDeps = createMockDependencies()
    mockClient = createMockSSH2Client();
    (SSH2Client as unknown as Mock).mockReturnValue(mockClient)

    sshService = new SSHServiceImpl(mockDeps, mockStore)
  })

  describe('connect', () => {
    it('should establish SSH connection with password', async () => {
      const config = createTestSSHConfig()

      mockSuccessfulConnection()

      const resultPromise = sshService.connect(config)

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10))

      const result = await resultPromise

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveProperty('id')
        expect(result.value).toHaveProperty('sessionId', config.sessionId)
        expect(result.value).toHaveProperty('client')
        expect(result.value.status).toBe('connected')
      }

      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          host: TEST_SSH.HOST,
          port: TEST_SSH.PORT,
          username: TEST_USERNAME,
          password: TEST_PASSWORD
        })
      )

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        config.sessionId,
        expect.objectContaining({
          type: 'CONNECTION_ESTABLISHED'
        })
      )
    })

    it('should handle connection with private key', async () => {
      const privateKey = '-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----'
      const config = createTestSSHConfig({ privateKey, password: undefined })

      mockSuccessfulConnection()

      const result = await sshService.connect(config)

      expect(result.ok).toBe(true)
      expect(mockClient.connect).toHaveBeenCalledWith(
        expect.objectContaining({
          privateKey
        })
      )
    })

    it('should handle connection errors', async () => {
      const config = createTestSSHConfig()

      // Mock connection error
      const error = new Error('Connection refused')
      mockClient.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler(error), 0)
        }
        return mockClient
      })

      const result = await sshService.connect(config)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Connection refused')
      }

      expect(mockStore.dispatch).toHaveBeenCalledWith(
        config.sessionId,
        expect.objectContaining({
          type: 'CONNECTION_ERROR'
        })
      )
    })

    it.skip('should handle connection timeout', async () => {
      const config = createTestSSHConfig({ readyTimeout: 100 }) // Short timeout for test

      // Don't trigger any events - let it timeout
      mockClient.on.mockReturnValue(mockClient)

      vi.useFakeTimers()
      const resultPromise = sshService.connect(config)
      vi.advanceTimersByTime(150)
      const result = await resultPromise
      vi.useRealTimers()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Connection timeout')
      }
    })
  })

  describe('shell', () => {
    it.skip('should open shell stream', async () => {
      const connectionId = createConnectionId('test-conn')
      const options: ShellOptions = {
        term: 'xterm-256color',
        rows: 24,
        cols: 80,
        env: { LANG: 'en_US.UTF-8' }
      }

      // First establish a connection
      const { config, result: connectResult } = await establishTestConnection()

      if (connectResult.ok) {
        // Mock shell creation
        const mockStream = new Duplex()
        mockClient.shell.mockImplementation((opts: any, callback: Function) => {
          callback(undefined, mockStream)
        })

        const shellResult = await sshService.shell(connectResult.value.id, options)

        expect(shellResult.ok).toBe(true)
        if (shellResult.ok) {
          expect(shellResult.value).toBe(mockStream)
        }

        expect(mockClient.shell).toHaveBeenCalledWith(
          expect.objectContaining({
            term: 'xterm-256color',
            rows: 24,
            cols: 80,
            env: { LANG: 'en_US.UTF-8' }
          }),
          expect.any(Function)
        )
      }
    })

    it.skip('should handle shell errors', async () => {
      const connectionId = createConnectionId('test-conn')
      const options: ShellOptions = {
        term: 'xterm-256color',
        rows: 24,
        cols: 80
      }

      // Setup connection
      const { config, result: connectResult } = await establishTestConnection()

      if (connectResult.ok) {
        // Mock shell error
        const error = new Error('Shell access denied')
        mockClient.shell.mockImplementation((opts: any, callback: Function) => {
          callback(error, null)
        })

        const shellResult = await sshService.shell(connectResult.value.id, options)

        expect(shellResult.ok).toBe(false)
        if (!shellResult.ok) {
          expect(shellResult.error.message).toContain('Shell access denied')
        }
      }
    })
  })

  describe('exec', () => {
    it.skip('should execute command', async () => {
      const command = 'ls -la'

      // Setup connection
      const { config, result: connectResult } = await establishTestConnection()

      if (connectResult.ok) {
        // Mock exec
        const mockStream = {
          on: vi.fn((event: string, handler: Function) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('file1.txt\nfile2.txt\n')), 0)
            } else if (event === 'close') {
              setTimeout(() => handler(0), 10)
            }
            return mockStream
          }),
          stderr: {
            on: vi.fn()
          }
        }

        mockClient.exec.mockImplementation((cmd: string, callback: Function) => {
          callback(undefined, mockStream)
        })

        const execResult = await sshService.exec(connectResult.value.id, command)

        expect(execResult.ok).toBe(true)
        if (execResult.ok) {
          expect(execResult.value.stdout).toContain('file1.txt')
          expect(execResult.value.code).toBe(0)
        }

        expect(mockClient.exec).toHaveBeenCalledWith(command, expect.any(Function))
      }
    })
  })

  describe('disconnect', () => {
    it.skip('should close connection', async () => {
      // Setup connection
      const { config, result: connectResult } = await establishTestConnection()

      if (connectResult.ok) {
        const disconnectResult = await sshService.disconnect(connectResult.value.id)

        expect(disconnectResult.ok).toBe(true)
        expect(mockClient.end).toHaveBeenCalled()
        expect(mockStore.dispatch).toHaveBeenCalledWith(
          config.sessionId,
          expect.objectContaining({
            type: 'CONNECTION_CLOSED'
          })
        )
      }
    })

    it('should handle non-existent connection', async () => {
      const connectionId = createConnectionId('non-existent')
      const result = await sshService.disconnect(connectionId)

      expect(result.ok).toBe(true) // Returns ok even if connection doesn't exist
      expect(mockClient.end).not.toHaveBeenCalled()
    })
  })

  describe('getConnectionStatus', () => {
    it.skip('should return connection status', async () => {
      // Setup connection
      const { config, result: connectResult } = await establishTestConnection()

      if (connectResult.ok) {
        const statusResult = sshService.getConnectionStatus(connectResult.value.id)

        expect(statusResult.ok).toBe(true)
        if (statusResult.ok && statusResult.value) {
          expect(statusResult.value.status).toBe('connected')
          expect(statusResult.value.host).toBe(TEST_SSH.HOST)
          expect(statusResult.value.username).toBe(TEST_USERNAME)
        }
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
    it.skip('should disconnect all connections for a session', async () => {
      const sessionId = createSessionId('test-session')

      // Create connection for the session
      const { config, result: connect1 } = await establishTestConnection({ sessionId })

      // Disconnect all connections for the session
      await sshService.disconnectSession(sessionId)

      expect(mockClient.end).toHaveBeenCalled()
      expect(mockStore.dispatch).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          type: 'CONNECTION_CLOSED'
        })
      )
    })
  })
})