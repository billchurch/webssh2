// tests/integration/host-key-verification.vitest.ts
// Integration tests for the full host key verification flow:
// temp SQLite DB -> HostKeyService -> createHostKeyVerifier -> mock socket

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { HostKeyService } from '../../app/services/host-key/host-key-service.js'
import {
  createHostKeyVerifier,
  extractAlgorithm,
} from '../../app/services/host-key/host-key-verifier.js'
import { SOCKET_EVENTS } from '../../app/constants/socket-events.js'
import type { HostKeyVerificationConfig } from '../../app/types/config.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOST_KEY_SCHEMA = `
CREATE TABLE IF NOT EXISTS host_keys (
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    algorithm TEXT NOT NULL,
    key TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    comment TEXT,
    PRIMARY KEY (host, port, algorithm)
);
`

// Deterministic test key data (not real SSH keys, but structurally valid for
// the extractAlgorithm helper: 4-byte BE length + algorithm + opaque data).
const TEST_KEY_ED25519 = 'AAAAC3NzaC1lZDI1NTE5AAAAIHVKcNtf2JfGHbMHOiT6VNBBpJIxMZpL'
const DIFFERENT_KEY = 'AAAAB3NzaC1yc2EAAAADAQABAAABgQC7lPe5xp0h'
const TEST_HOST = 'server1.example.com'
const TEST_PORT = 22

interface MockSocket {
  emit: ReturnType<typeof import('vitest').vi.fn>
  once: ReturnType<typeof import('vitest').vi.fn>
  removeListener: ReturnType<typeof import('vitest').vi.fn>
}

function createMockSocket(): MockSocket {
  return {
    emit: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
  }
}

function mockLog(..._args: unknown[]): void {
  // no-op
}

/**
 * Invoke the verifier with a key buffer and return a promise that resolves
 * when the SSH2-style `verify(result)` callback fires.
 */
function callVerifier(
  verifier: (key: Buffer, verify: (valid: boolean) => void) => void,
  keyBuffer: Buffer
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    verifier(keyBuffer, (valid: boolean) => {
      resolve(valid)
    })
  })
}

/**
 * Create a temp directory with a seeded SQLite host_keys DB.
 */
function seedDb(dbPath: string, rows: Array<{ host: string; port: number; algorithm: string; key: string }>): void {
  const db = new Database(dbPath)
  db.exec(HOST_KEY_SCHEMA)

  const insert = db.prepare(
    'INSERT INTO host_keys (host, port, algorithm, key) VALUES (?, ?, ?, ?)'
  )

  for (const row of rows) {
    insert.run(row.host, row.port, row.algorithm, row.key)
  }

  db.close()
}

function buildConfig(overrides: Partial<HostKeyVerificationConfig> & {
  serverStoreEnabled?: boolean
  clientStoreEnabled?: boolean
  dbPath?: string
}): HostKeyVerificationConfig {
  return {
    enabled: overrides.enabled ?? true,
    mode: overrides.mode ?? 'server',
    unknownKeyAction: overrides.unknownKeyAction ?? 'reject',
    serverStore: {
      enabled: overrides.serverStoreEnabled ?? true,
      dbPath: overrides.dbPath ?? '/nonexistent.db',
    },
    clientStore: {
      enabled: overrides.clientStoreEnabled ?? false,
    },
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Host key verification integration', () => {
  let tmpDir: string
  let dbPath: string
  let socket: MockSocket

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hkv-integ-'))
    dbPath = path.join(tmpDir, 'hostkeys.db')
    socket = createMockSocket()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('trusts a key that matches the server store and emits hostkey:verified with source "server"', async () => {
    // Determine algorithm from the test key so we seed the DB with the right value
    const keyBuffer = Buffer.from(TEST_KEY_ED25519, 'base64')
    const algorithm = extractAlgorithm(keyBuffer)

    seedDb(dbPath, [
      { host: TEST_HOST, port: TEST_PORT, algorithm, key: TEST_KEY_ED25519 },
    ])

    const config = buildConfig({ dbPath, serverStoreEnabled: true })
    const service = new HostKeyService(config)

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, keyBuffer)

    expect(result).toBe(true)
    expect(socket.emit).toHaveBeenCalledTimes(1)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_VERIFIED,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
        algorithm,
        source: 'server',
      })
    )

    service.close()
  })

  it('rejects a mismatched key and emits hostkey:mismatch', async () => {
    const keyBuffer = Buffer.from(TEST_KEY_ED25519, 'base64')
    const algorithm = extractAlgorithm(keyBuffer)

    // Seed DB with a DIFFERENT key for the same host/port/algorithm
    seedDb(dbPath, [
      { host: TEST_HOST, port: TEST_PORT, algorithm, key: DIFFERENT_KEY },
    ])

    const config = buildConfig({ dbPath, serverStoreEnabled: true })
    const service = new HostKeyService(config)

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, keyBuffer)

    expect(result).toBe(false)
    expect(socket.emit).toHaveBeenCalledTimes(1)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_MISMATCH,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
        algorithm,
        presentedFingerprint: HostKeyService.computeFingerprint(TEST_KEY_ED25519),
        storedFingerprint: HostKeyService.computeFingerprint(DIFFERENT_KEY),
        source: 'server',
      })
    )

    service.close()
  })

  it('rejects an unknown key when unknownKeyAction is "reject" and emits hostkey:rejected', async () => {
    const keyBuffer = Buffer.from(TEST_KEY_ED25519, 'base64')
    const algorithm = extractAlgorithm(keyBuffer)

    // Seed an empty DB (no keys at all)
    seedDb(dbPath, [])

    const config = buildConfig({
      dbPath,
      serverStoreEnabled: true,
      clientStoreEnabled: false,
      unknownKeyAction: 'reject',
    })
    const service = new HostKeyService(config)

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, keyBuffer)

    expect(result).toBe(false)
    expect(socket.emit).toHaveBeenCalledTimes(1)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_REJECTED,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
        algorithm,
        fingerprint: HostKeyService.computeFingerprint(TEST_KEY_ED25519),
      })
    )

    service.close()
  })

  it('allows an unknown key when unknownKeyAction is "alert" and emits hostkey:alert', async () => {
    const keyBuffer = Buffer.from(TEST_KEY_ED25519, 'base64')
    const algorithm = extractAlgorithm(keyBuffer)

    seedDb(dbPath, [])

    const config = buildConfig({
      dbPath,
      serverStoreEnabled: true,
      clientStoreEnabled: false,
      unknownKeyAction: 'alert',
    })
    const service = new HostKeyService(config)

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, keyBuffer)

    expect(result).toBe(true)
    expect(socket.emit).toHaveBeenCalledTimes(1)
    expect(socket.emit).toHaveBeenCalledWith(
      SOCKET_EVENTS.HOSTKEY_ALERT,
      expect.objectContaining({
        host: TEST_HOST,
        port: TEST_PORT,
        algorithm,
        fingerprint: HostKeyService.computeFingerprint(TEST_KEY_ED25519),
      })
    )

    service.close()
  })

  it('returns true with no socket events when the feature is disabled', async () => {
    const keyBuffer = Buffer.from(TEST_KEY_ED25519, 'base64')

    // DB does not need to exist when the feature is disabled
    const config = buildConfig({
      enabled: false,
      serverStoreEnabled: false,
      clientStoreEnabled: false,
    })
    const service = new HostKeyService(config)

    const verifier = createHostKeyVerifier({
      hostKeyService: service,
      socket: socket as unknown as import('socket.io').Socket,
      host: TEST_HOST,
      port: TEST_PORT,
      log: mockLog,
    })

    const result = await callVerifier(verifier, keyBuffer)

    expect(result).toBe(true)
    expect(socket.emit).not.toHaveBeenCalled()

    service.close()
  })
})
