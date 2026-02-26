// tests/unit/services/host-key/host-key-service.vitest.ts
// Tests for HostKeyService

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { HostKeyService } from '../../../../app/services/host-key/host-key-service.js'
import type { HostKeyVerificationConfig } from '../../../../app/types/config.js'
import {
  HOST_KEY_SCHEMA,
  createTempDbContext,
  cleanupTempDbContext,
  type TestContext,
} from './host-key-test-fixtures.js'

const TEST_KEY_ED25519 = 'AAAAC3NzaC1lZDI1NTE5AAAAIHVKcNtf2JfGHbMHOiT6VNBBpJIxMZpL'
const TEST_KEY_RSA = 'AAAAB3NzaC1yc2EAAAADAQABAAABgQC7lPe5xp0h'

function buildConfig(overrides?: Partial<HostKeyVerificationConfig>): HostKeyVerificationConfig {
  return {
    enabled: true,
    mode: 'hybrid',
    unknownKeyAction: 'prompt',
    serverStore: {
      enabled: true,
      dbPath: '/data/hostkeys.db',
    },
    clientStore: {
      enabled: true,
    },
    ...overrides,
  }
}

function seedTestDb(dbPath: string): void {
  const db = new Database(dbPath)
  db.exec(HOST_KEY_SCHEMA)
  const insert = db.prepare(
    'INSERT INTO host_keys (host, port, algorithm, key, comment) VALUES (?, ?, ?, ?, ?)'
  )
  insert.run('server1.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519, 'test key')
  db.close()
}

describe('HostKeyService', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTempDbContext('hostkey-svc-')
  })

  afterEach(() => {
    cleanupTempDbContext(ctx)
  })

  describe('getters', () => {
    it('should expose isEnabled', () => {
      const svc = new HostKeyService(buildConfig({ enabled: true }))
      expect(svc.isEnabled).toBe(true)
      svc.close()
    })

    it('should expose isEnabled=false', () => {
      const svc = new HostKeyService(buildConfig({ enabled: false }))
      expect(svc.isEnabled).toBe(false)
      svc.close()
    })

    it('should expose serverStoreEnabled', () => {
      const svc = new HostKeyService(buildConfig({
        serverStore: { enabled: true, dbPath: ctx.dbPath },
      }))
      expect(svc.serverStoreEnabled).toBe(true)
      svc.close()
    })

    it('should expose clientStoreEnabled', () => {
      const svc = new HostKeyService(buildConfig({
        clientStore: { enabled: false },
      }))
      expect(svc.clientStoreEnabled).toBe(false)
      svc.close()
    })

    it('should expose unknownKeyAction', () => {
      const svc = new HostKeyService(buildConfig({ unknownKeyAction: 'reject' }))
      expect(svc.unknownKeyAction).toBe('reject')
      svc.close()
    })
  })

  describe('serverLookup', () => {
    it('should delegate to the underlying store', () => {
      seedTestDb(ctx.dbPath)
      const config = buildConfig({
        serverStore: { enabled: true, dbPath: ctx.dbPath },
      })
      const svc = new HostKeyService(config)

      const result = svc.serverLookup('server1.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519)

      expect(result.status).toBe('trusted')
      svc.close()
    })

    it('should return "unknown" when server store is not enabled', () => {
      const config = buildConfig({
        serverStore: { enabled: false, dbPath: ctx.dbPath },
      })
      const svc = new HostKeyService(config)

      const result = svc.serverLookup('server1.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519)

      expect(result.status).toBe('unknown')
      svc.close()
    })
  })

  describe('computeFingerprint', () => {
    it('should produce a SHA256: prefixed fingerprint', () => {
      const fingerprint = HostKeyService.computeFingerprint(TEST_KEY_ED25519)

      expect(fingerprint.startsWith('SHA256:')).toBe(true)
      // Base64 hash should be non-empty
      expect(fingerprint.length).toBeGreaterThan(7)
    })

    it('should be deterministic for the same key', () => {
      const fp1 = HostKeyService.computeFingerprint(TEST_KEY_ED25519)
      const fp2 = HostKeyService.computeFingerprint(TEST_KEY_ED25519)

      expect(fp1).toBe(fp2)
    })

    it('should produce different fingerprints for different keys', () => {
      const fp1 = HostKeyService.computeFingerprint(TEST_KEY_ED25519)
      const fp2 = HostKeyService.computeFingerprint(TEST_KEY_RSA)

      expect(fp1).not.toBe(fp2)
    })

    it('should use base64 encoding in the hash part', () => {
      const fingerprint = HostKeyService.computeFingerprint(TEST_KEY_ED25519)
      const hashPart = fingerprint.slice('SHA256:'.length)

      // Base64 characters only (with padding)
      expect(hashPart).toMatch(/^[A-Za-z0-9+/]+=*$/)
    })
  })

  describe('close', () => {
    it('should close the underlying store', () => {
      seedTestDb(ctx.dbPath)
      const config = buildConfig({
        serverStore: { enabled: true, dbPath: ctx.dbPath },
      })
      const svc = new HostKeyService(config)

      svc.close()

      // After close, lookup should return unknown (store is closed)
      const result = svc.serverLookup('server1.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519)
      expect(result.status).toBe('unknown')
    })

    it('should be safe to call close multiple times', () => {
      const svc = new HostKeyService(buildConfig())
      svc.close()
      svc.close() // Should not throw
    })
  })
})
