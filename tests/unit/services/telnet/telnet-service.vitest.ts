import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as net from 'node:net'
import { createSessionId, createConnectionId } from '../../../../app/types/branded.js'
import { TelnetServiceImpl } from '../../../../app/services/telnet/telnet-service.js'
import type { TelnetConnectionConfig, ServiceDependencies } from '../../../../app/services/interfaces.js'
import { IAC, DO, NAWS, SB, SE, ECHO } from '../../../../app/services/telnet/telnet-negotiation.js'
import { TEST_USERNAME, TEST_PASSWORD } from '../../../test-constants.js'
import { createMockDependencies } from '../../../test-utils.js'

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Create a test telnet config with sensible defaults
 */
const createTestConfig = (
  port: number,
  overrides?: Partial<TelnetConnectionConfig>
): TelnetConnectionConfig => ({
  sessionId: createSessionId('test-session-1'),
  host: '127.0.0.1',
  port,
  timeout: 5000,
  term: 'xterm-256color',
  ...overrides,
})

/**
 * Wait for a condition with timeout
 */
const waitFor = (
  predicate: () => boolean,
  timeoutMs = 2000,
  intervalMs = 10
): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const check = (): void => {
      if (predicate()) {
        resolve()
      } else if (Date.now() > deadline) {
        reject(new Error('waitFor timed out'))
      } else {
        setTimeout(check, intervalMs)
      }
    }
    check()
  })

// ── Tests ────────────────────────────────────────────────────────────────

describe('TelnetServiceImpl', () => {
  let server: net.Server
  let serverPort: number
  let service: TelnetServiceImpl
  let deps: ServiceDependencies

  beforeEach(async () => {
    deps = createMockDependencies()
    service = new TelnetServiceImpl(deps)

    // Create a simple echo server for testing
    server = net.createServer((socket) => {
      socket.on('data', (data) => {
        // Filter out IAC sequences before echoing
        const bytes: number[] = []
        let i = 0
        while (i < data.length) {
          if (data[i] === IAC && i + 1 < data.length) {
            // Skip IAC sequences
            if (data[i + 1] === SB) {
              // Skip subnegotiation: IAC SB ... IAC SE
              i += 2
              while (i < data.length) {
                if (data[i] === IAC && i + 1 < data.length && data[i + 1] === SE) {
                  i += 2
                  break
                }
                i++
              }
              continue
            }
            // Skip 3-byte commands: IAC WILL/WONT/DO/DONT <option>
            i += 3
            continue
          }
          bytes.push(data[i])
          i++
        }
        if (bytes.length > 0) {
          socket.write(Buffer.from(bytes))
        }
      })
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as net.AddressInfo).port
        resolve()
      })
    })
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  })

  // ── connect() ────────────────────────────────────────────────────────

  describe('connect()', () => {
    it('should establish a telnet connection', async () => {
      const config = createTestConfig(serverPort)
      const result = await service.connect(config)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.status).toBe('connected')
        expect(result.value.protocol).toBe('telnet')
        expect(result.value.host).toBe('127.0.0.1')
        expect(result.value.port).toBe(serverPort)
        expect(result.value.sessionId).toBe(config.sessionId)
        expect(result.value.id).toBeDefined()
        // Clean up
        await service.disconnect(result.value.id)
      }
    })

    it('should timeout on unreachable host', async () => {
      const config = createTestConfig(1, {
        host: '192.0.2.1', // RFC 5737 TEST-NET - guaranteed unreachable
        timeout: 500,
      })
      const result = await service.connect(config)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toMatch(/timeout|timed out|ECONNREFUSED|ENETUNREACH/i)
      }
    })

    it('should fail on connection refused', async () => {
      // Close the server first so nothing is listening
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })

      // Use a port that nothing is listening on
      const config = createTestConfig(serverPort, { timeout: 1000 })
      const result = await service.connect(config)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toMatch(/ECONNREFUSED|refused|timeout/i)
      }

      // Re-create server so afterEach doesn't fail
      server = net.createServer()
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          serverPort = (server.address() as net.AddressInfo).port
          resolve()
        })
      })
    })

    it('should store username from config', async () => {
      const config = createTestConfig(serverPort, {
        username: TEST_USERNAME,
      })
      const result = await service.connect(config)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.username).toBe(TEST_USERNAME)
        await service.disconnect(result.value.id)
      }
    })
  })

  // ── shell() ──────────────────────────────────────────────────────────

  describe('shell()', () => {
    it('should return a Duplex stream', async () => {
      const connectResult = await service.connect(createTestConfig(serverPort))
      expect(connectResult.ok).toBe(true)
      if (!connectResult.ok) { return }

      const connectionId = connectResult.value.id
      const shellResult = await service.shell(connectionId, { rows: 24, cols: 80 })

      expect(shellResult.ok).toBe(true)
      if (shellResult.ok) {
        expect(shellResult.value).toBeDefined()
        expect(typeof shellResult.value.write).toBe('function')
        expect(typeof shellResult.value.on).toBe('function')
        shellResult.value.destroy()
      }
      await service.disconnect(connectionId)
    })

    it('should forward data bidirectionally', async () => {
      const connectResult = await service.connect(createTestConfig(serverPort))
      expect(connectResult.ok).toBe(true)
      if (!connectResult.ok) { return }

      const connectionId = connectResult.value.id
      const shellResult = await service.shell(connectionId, { rows: 24, cols: 80 })
      expect(shellResult.ok).toBe(true)
      if (!shellResult.ok) { return }

      const shellStream = shellResult.value
      const received: Buffer[] = []

      shellStream.on('data', (data: Buffer) => {
        received.push(data)
      })

      // Write data through the shell stream (client → server)
      shellStream.write(Buffer.from('hello'))

      // Wait for echoed data (server → client)
      await waitFor(() => {
        const total = Buffer.concat(received).toString()
        return total.includes('hello')
      })

      const totalData = Buffer.concat(received).toString()
      expect(totalData).toContain('hello')

      shellStream.destroy()
      await service.disconnect(connectionId)
    })

    it('should fail for unknown connection ID', async () => {
      const fakeId = createConnectionId('nonexistent-connection-id')
      const result = await service.shell(fakeId, { rows: 24, cols: 80 })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toMatch(/not found/i)
      }
    })

    it('should strip IAC sequences from server data', async () => {
      // Create a server that sends IAC-mixed data when receiving any data
      const iacServer = net.createServer((socket) => {
        // Send IAC-mixed data when the client sends something (like NAWS)
        socket.once('data', () => {
          const payload = Buffer.from([
            ...Buffer.from('clean'),
            IAC, DO, ECHO,
            ...Buffer.from('data'),
          ])
          socket.write(payload)
        })
      })

      const iacPort = await new Promise<number>((resolve) => {
        iacServer.listen(0, '127.0.0.1', () => {
          resolve((iacServer.address() as net.AddressInfo).port)
        })
      })

      try {
        const connectResult = await service.connect(createTestConfig(iacPort))
        expect(connectResult.ok).toBe(true)
        if (!connectResult.ok) { return }

        const connectionId = connectResult.value.id

        const shellResult = await service.shell(connectionId, { rows: 24, cols: 80 })
        expect(shellResult.ok).toBe(true)
        if (!shellResult.ok) { return }

        const shellStream = shellResult.value
        const received: Buffer[] = []

        shellStream.on('data', (data: Buffer) => {
          received.push(data)
        })

        await waitFor(() => {
          const total = Buffer.concat(received).toString()
          return total.includes('clean') && total.includes('data')
        })

        const totalData = Buffer.concat(received).toString()
        expect(totalData).toContain('cleandata')

        shellStream.destroy()
        await service.disconnect(connectionId)
      } finally {
        await new Promise<void>((resolve) => {
          iacServer.close(() => resolve())
        })
      }
    })
  })

  // ── resize() ─────────────────────────────────────────────────────────

  describe('resize()', () => {
    it('should send NAWS negotiation', async () => {
      // Track what the server receives
      const serverReceived: Buffer[] = []
      const nawsServer = net.createServer((socket) => {
        socket.on('data', (data) => {
          serverReceived.push(Buffer.from(data))
        })
      })

      const nawsPort = await new Promise<number>((resolve) => {
        nawsServer.listen(0, '127.0.0.1', () => {
          resolve((nawsServer.address() as net.AddressInfo).port)
        })
      })

      try {
        const connectResult = await service.connect(createTestConfig(nawsPort))
        expect(connectResult.ok).toBe(true)
        if (!connectResult.ok) { return }

        const connectionId = connectResult.value.id

        // Must open shell first to set up negotiator
        const shellResult = await service.shell(connectionId, { rows: 24, cols: 80 })
        expect(shellResult.ok).toBe(true)

        // Clear server buffer from initial negotiation
        serverReceived.length = 0

        const resizeResult = service.resize(connectionId, 50, 120)
        expect(resizeResult.ok).toBe(true)

        // Wait for data to arrive at server
        await waitFor(() => serverReceived.length > 0)

        // The NAWS data should contain IAC SB NAWS ... IAC SE
        const allReceived = Buffer.concat(serverReceived)
        // Check that NAWS subnegotiation bytes are present
        expect(allReceived).toContain(IAC)

        // Verify the NAWS sequence structure: IAC SB NAWS <cols-high> <cols-low> <rows-high> <rows-low> IAC SE
        // cols=120: high=0, low=120; rows=50: high=0, low=50
        const nawsSequence = Buffer.from([IAC, SB, NAWS, 0, 120, 0, 50, IAC, SE])
        const allReceivedStr = allReceived.toString('hex')
        const nawsStr = nawsSequence.toString('hex')
        expect(allReceivedStr).toContain(nawsStr)

        if (shellResult.ok) {
          shellResult.value.destroy()
        }
        await service.disconnect(connectionId)
      } finally {
        await new Promise<void>((resolve) => {
          nawsServer.close(() => resolve())
        })
      }
    })

    it('should fail for unknown connection ID', () => {
      const fakeId = createConnectionId('nonexistent-id')
      const result = service.resize(fakeId, 24, 80)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toMatch(/not found/i)
      }
    })

    it('should fail if shell has not been opened (no negotiator)', async () => {
      const connectResult = await service.connect(createTestConfig(serverPort))
      expect(connectResult.ok).toBe(true)
      if (!connectResult.ok) { return }

      const connectionId = connectResult.value.id
      // Resize without opening shell first
      const resizeResult = service.resize(connectionId, 50, 120)

      expect(resizeResult.ok).toBe(false)
      if (!resizeResult.ok) {
        expect(resizeResult.error.message).toMatch(/negotiator|shell|not initialized/i)
      }

      await service.disconnect(connectionId)
    })
  })

  // ── disconnect() ─────────────────────────────────────────────────────

  describe('disconnect()', () => {
    it('should close the socket and remove from pool', async () => {
      const connectResult = await service.connect(createTestConfig(serverPort))
      expect(connectResult.ok).toBe(true)
      if (!connectResult.ok) { return }

      const connectionId = connectResult.value.id
      const disconnectResult = await service.disconnect(connectionId)

      expect(disconnectResult.ok).toBe(true)

      // Verify connection no longer exists
      const statusResult = service.getConnectionStatus(connectionId)
      expect(statusResult.ok).toBe(true)
      if (statusResult.ok) {
        expect(statusResult.value).toBeNull()
      }
    })

    it('should succeed for already disconnected connection', async () => {
      const fakeId = createConnectionId('already-gone')
      const result = await service.disconnect(fakeId)

      // Should succeed gracefully (idempotent)
      expect(result.ok).toBe(true)
    })
  })

  // ── getConnectionStatus() ────────────────────────────────────────────

  describe('getConnectionStatus()', () => {
    it('should return connection when it exists', async () => {
      const connectResult = await service.connect(createTestConfig(serverPort))
      expect(connectResult.ok).toBe(true)
      if (!connectResult.ok) { return }

      const connectionId = connectResult.value.id
      const statusResult = service.getConnectionStatus(connectionId)

      expect(statusResult.ok).toBe(true)
      if (statusResult.ok) {
        expect(statusResult.value).not.toBeNull()
        expect(statusResult.value?.id).toBe(connectionId)
        expect(statusResult.value?.protocol).toBe('telnet')
      }

      await service.disconnect(connectionId)
    })

    it('should return null for nonexistent connection', () => {
      const fakeId = createConnectionId('does-not-exist')
      const statusResult = service.getConnectionStatus(fakeId)

      expect(statusResult.ok).toBe(true)
      if (statusResult.ok) {
        expect(statusResult.value).toBeNull()
      }
    })
  })

  // ── Auth integration ─────────────────────────────────────────────────

  describe('shell() with authentication', () => {
    it('should handle auth when login prompts and credentials are configured', async () => {
      // Create a server that sends a login prompt and responds
      const authServer = net.createServer((socket) => {
        socket.write('login: ')
        socket.on('data', (data) => {
          const text = data.toString()
          if (text.includes(TEST_USERNAME)) {
            socket.write('Password: ')
          } else if (text.includes(TEST_PASSWORD)) {
            socket.write('Welcome!\r\n$ ')
          }
        })
      })

      const authPort = await new Promise<number>((resolve) => {
        authServer.listen(0, '127.0.0.1', () => {
          resolve((authServer.address() as net.AddressInfo).port)
        })
      })

      try {
        const config = createTestConfig(authPort, {
          username: TEST_USERNAME,
          password: TEST_PASSWORD,
          loginPrompt: /login:\s*$/i,
          passwordPrompt: /password:\s*$/i,
          expectTimeout: 5000,
        })

        const connectResult = await service.connect(config)
        expect(connectResult.ok).toBe(true)
        if (!connectResult.ok) { return }

        const connectionId = connectResult.value.id
        const shellResult = await service.shell(connectionId, { rows: 24, cols: 80 })
        expect(shellResult.ok).toBe(true)
        if (!shellResult.ok) { return }

        const shellStream = shellResult.value
        const received: Buffer[] = []

        shellStream.on('data', (data: Buffer) => {
          received.push(data)
        })

        // Wait for the auth process to complete and Welcome message to arrive
        await waitFor(() => {
          const total = Buffer.concat(received).toString()
          return total.includes('Welcome')
        }, 5000)

        const totalData = Buffer.concat(received).toString()
        expect(totalData).toContain('Welcome')

        shellStream.destroy()
        await service.disconnect(connectionId)
      } finally {
        await new Promise<void>((resolve) => {
          authServer.close(() => resolve())
        })
      }
    })
  })
})
