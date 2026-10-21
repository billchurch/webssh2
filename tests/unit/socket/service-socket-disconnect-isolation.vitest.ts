/**
 * Two sockets that log in with the same SSH username must stay isolated:
 * one socket disconnecting must not touch the other's session or transfers.
 */

import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { Socket } from 'socket.io'
import type { UnifiedAuthPipeline } from '../../../app/auth/auth-pipeline.js'
import type { AuthMethod } from '../../../app/auth/providers/auth-provider.interface.js'
import type { Config } from '../../../app/types/config.js'
import type { FileService, Services } from '../../../app/services/interfaces.js'
import type {
  AuthCredentials,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData
} from '../../../app/types/contracts/v1/socket.js'
import {
  createAdapterSharedState,
  type AdapterContext
} from '../../../app/socket/adapters/service-socket-shared.js'
import { ServiceSocketAuthentication } from '../../../app/socket/adapters/service-socket-authentication.js'
import { ServiceSocketControl } from '../../../app/socket/adapters/service-socket-control.js'
import { ServiceSocketSftp } from '../../../app/socket/adapters/service-socket-sftp.js'
import { ServiceSocketPrompt } from '../../../app/socket/adapters/service-socket-prompt.js'
import { AuthServiceImpl } from '../../../app/services/auth/auth-service.js'
import { SessionServiceImpl } from '../../../app/services/session/session-service.js'
import { TerminalServiceImpl } from '../../../app/services/terminal/terminal-service.js'
import { TransferManager } from '../../../app/services/sftp/transfer-manager.js'
import { SessionStore } from '../../../app/state/store.js'
import { SOCKET_EVENTS } from '../../../app/constants/socket-events.js'
import { createTransferId, type SessionId, type TransferId } from '../../../app/types/branded.js'
import {
  createMockDependencies,
  createMockServices,
  createMockSocketConfig,
  createStructuredLoggerStub
} from '../../test-utils.js'
import { TEST_PASSWORD, TEST_PASSWORDS, TEST_SSH, TEST_USERNAME } from '../../test-constants.js'

type TestSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

const stubPipeline = (): UnifiedAuthPipeline => {
  let stored: Record<string, unknown> | null = null
  const pipeline: Partial<UnifiedAuthPipeline> = {
    getAuthMethod: vi.fn((): AuthMethod => 'manual'),
    isAuthenticated: vi.fn(() => false),
    requiresAuthRequest: vi.fn(() => false),
    setManualCredentials: vi.fn((creds: Record<string, unknown>) => {
      stored = creds
      return true
    }),
    getCredentials: vi.fn(() => stored)
  }
  return pipeline as UnifiedAuthPipeline
}

vi.mock('../../../app/auth/auth-pipeline.js', () => ({
  // Use function syntax for Vitest 4.0 constructor mock compatibility
  UnifiedAuthPipeline: vi.fn(function() {
    return stubPipeline()
  })
}))

interface SharedServices {
  services: Services
  store: SessionStore
  authService: AuthServiceImpl
  transfers: TransferManager
}

/**
 * Real auth, store, session and terminal services shared by both sockets.
 * SFTP transfer tracking uses the real TransferManager; SSH is mocked.
 */
const createSharedServices = (): SharedServices => {
  const deps = createMockDependencies()
  const store = new SessionStore()
  const authService = new AuthServiceImpl(deps, store)
  const transfers = new TransferManager({ maxConcurrentTransfers: 4, defaultRateLimitBytesPerSec: 0 })
  const sftp: Partial<FileService> = {
    isEnabled: () => true,
    closeSession: vi.fn(),
    cancelSessionTransfers: (sessionId: SessionId) => {
      transfers.cancelSessionTransfers(sessionId)
    },
    verifyTransferOwnership: (transferId: TransferId, sessionId: SessionId) =>
      transfers.verifyOwnership(transferId, sessionId)
  }

  const mocks = createMockServices({ sshConnectSucceeds: true }) as Services
  const services = {
    ...mocks,
    auth: authService,
    session: new SessionServiceImpl(deps, store),
    terminal: new TerminalServiceImpl(deps, store),
    sftp
  } as unknown as Services

  return { services, store, authService, transfers }
}

const createSocket = (id: string): TestSocket => {
  const emitter = new EventEmitter()
  const socket = {
    id,
    handshake: { headers: {}, address: TEST_SSH.IP_ADDRESS },
    request: {
      headers: {},
      session: { save: vi.fn((cb: () => void) => cb()) }
    },
    on: (event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener)
      return socket
    },
    onAny: vi.fn(),
    emit: vi.fn(),
    // Test-only: deliver a client event to the registered handlers
    receive: (event: string, ...args: unknown[]) =>
      Promise.all(emitter.listeners(event).map(listener => (listener as (...a: unknown[]) => unknown)(...args)))
  }
  return socket as unknown as TestSocket
}

const receive = (socket: TestSocket, event: string, ...args: unknown[]): Promise<unknown> =>
  (socket as unknown as { receive: (e: string, ...a: unknown[]) => Promise<unknown> }).receive(event, ...args)

const credentialsFor = (password: string): AuthCredentials => ({
  username: TEST_USERNAME,
  host: TEST_SSH.HOST,
  port: TEST_SSH.PORT,
  password
})

const startUpload = (transfers: TransferManager, transferId: TransferId, sessionId: SessionId): void => {
  const started = transfers.startTransfer({
    transferId,
    sessionId,
    direction: 'upload',
    remotePath: '/tmp/file.txt',
    fileName: 'file.txt',
    totalBytes: 100
  })
  expect(started.ok).toBe(true)
}

interface SocketParts {
  context: AdapterContext
  auth: ServiceSocketAuthentication
  control: ServiceSocketControl
  sftp: ServiceSocketSftp
}

const createSocketParts = (id: string, services: Services): SocketParts => {
  const context: AdapterContext = {
    socket: createSocket(id),
    config: createMockSocketConfig() as Config,
    services,
    authPipeline: stubPipeline(),
    state: createAdapterSharedState(),
    protocol: 'ssh',
    debug: vi.fn(),
    logger: createStructuredLoggerStub()
  }
  return {
    context,
    auth: new ServiceSocketAuthentication(context, new ServiceSocketPrompt(context)),
    control: new ServiceSocketControl(context),
    sftp: new ServiceSocketSftp(context)
  }
}

const requireSessionId = (context: AdapterContext): SessionId => {
  const { sessionId } = context.state
  if (sessionId === null) {
    throw new Error(`socket ${context.socket.id} is not authenticated`)
  }
  return sessionId
}

describe('same-username sockets on disconnect', () => {
  it('SFTP and control cleanup of one socket leave the other socket alone', async () => {
    const { services, store, authService, transfers } = createSharedServices()
    const first = createSocketParts('socket-a', services)
    const second = createSocketParts('socket-b', services)

    await first.auth.handleAuthentication(credentialsFor(TEST_PASSWORD))
    await second.auth.handleAuthentication(credentialsFor(TEST_PASSWORDS.secret))
    const firstId = requireSessionId(first.context)
    const secondId = requireSessionId(second.context)
    expect(secondId).not.toBe(firstId)

    const firstTransfer = createTransferId('transfer-a')
    const secondTransfer = createTransferId('transfer-b')
    startUpload(transfers, firstTransfer, firstId)
    startUpload(transfers, secondTransfer, secondId)

    // The first socket's own cleanup, while it still knows its ids
    first.sftp.handleDisconnect()
    first.control.handleDisconnect()

    expect(transfers.getTransfer(firstTransfer)).toBeUndefined()
    expect(transfers.getTransfer(secondTransfer)).toBeDefined()
    expect(transfers.verifyOwnership(secondTransfer, secondId).ok).toBe(true)
    expect(store.getSessionIds()).toEqual([secondId])
    expect(authService.getSessionInfo(firstId)).toEqual({ ok: true, value: null })
    expect(authService.getSessionInfo(secondId)).toMatchObject({ ok: true, value: { sessionId: secondId } })
    expect(second.context.state.sessionId).toBe(secondId)
  })

  it('a disconnect event on one adapter keeps the other socket\'s session and transfers', async () => {
    const { ServiceSocketAdapter } = await import('../../../app/socket/adapters/service-socket-adapter.js')
    const { services, store, authService, transfers } = createSharedServices()
    const config = createMockSocketConfig() as Config
    const firstSocket = createSocket('socket-a')
    const secondSocket = createSocket('socket-b')
    // eslint-disable-next-line no-new -- the adapter registers socket handlers on construction
    new ServiceSocketAdapter(firstSocket, config, services) //NOSONAR
    // eslint-disable-next-line no-new -- the adapter registers socket handlers on construction
    new ServiceSocketAdapter(secondSocket, config, services) //NOSONAR

    await receive(firstSocket, SOCKET_EVENTS.AUTH, credentialsFor(TEST_PASSWORD))
    await receive(secondSocket, SOCKET_EVENTS.AUTH, credentialsFor(TEST_PASSWORDS.secret))

    const [firstId, secondId] = store.getSessionIds()
    expect(firstId).toBeDefined()
    expect(secondId).toBeDefined()
    expect(secondId).not.toBe(firstId)
    const secondTransfer = createTransferId('transfer-b')
    startUpload(transfers, secondTransfer, secondId as SessionId)

    await receive(firstSocket, SOCKET_EVENTS.DISCONNECT)

    expect(store.getSessionIds()).toEqual([secondId])
    expect(authService.getSessionInfo(firstId as SessionId)).toEqual({ ok: true, value: null })
    expect(transfers.getTransfer(secondTransfer)).toBeDefined()
    expect(transfers.verifyOwnership(secondTransfer, secondId as SessionId).ok).toBe(true)
  })
})
