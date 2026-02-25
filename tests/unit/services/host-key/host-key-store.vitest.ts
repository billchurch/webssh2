// tests/unit/services/host-key/host-key-store.vitest.ts
// Tests for HostKeyStore SQLite wrapper

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { HostKeyStore } from '../../../../app/services/host-key/host-key-store.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const HOST_KEY_SCHEMA = `
CREATE TABLE host_keys (
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    algorithm TEXT NOT NULL,
    key TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    comment TEXT,
    PRIMARY KEY (host, port, algorithm)
);
`

// Example base64 keys for testing (not real SSH keys, just deterministic test data)
const TEST_KEY_ED25519 = 'AAAAC3NzaC1lZDI1NTE5AAAAIHVKcNtf2JfGHbMHOiT6VNBBpJIxMZpL'
const TEST_KEY_RSA = 'AAAAB3NzaC1yc2EAAAADAQABAAABgQC7lPe5xp0h'
const TEST_KEY_ECDSA = 'AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAI'

interface TestContext {
  tmpDir: string
  dbPath: string
}

function createTestDb(dbPath: string): void {
  const db = new Database(dbPath)
  db.exec(HOST_KEY_SCHEMA)
  db.close()
}

function seedTestDb(dbPath: string): void {
  const db = new Database(dbPath)
  db.exec(HOST_KEY_SCHEMA)

  const insert = db.prepare(
    'INSERT INTO host_keys (host, port, algorithm, key, comment) VALUES (?, ?, ?, ?, ?)'
  )

  insert.run('server1.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519, 'test key 1')
  insert.run('server1.example.com', 22, 'ssh-rsa', TEST_KEY_RSA, 'test key 2')
  insert.run('server2.example.com', 2222, 'ecdsa-sha2-nistp256', TEST_KEY_ECDSA, 'test key 3')

  db.close()
}

void describe('HostKeyStore', () => {
  let ctx: TestContext

  beforeEach(() => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hostkey-test-'))
    const dbPath = path.join(tmpDir, 'hostkeys.db')
    ctx = { tmpDir, dbPath }
  })

  afterEach(() => {
    fs.rmSync(ctx.tmpDir, { recursive: true, force: true })
  })

  void describe('constructor', () => {
    it('should open existing database file', () => {
      createTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      expect(store.isOpen()).toBe(true)
      store.close()
    })

    it('should set db to null when file does not exist', () => {
      const store = new HostKeyStore('/nonexistent/path/hostkeys.db')

      expect(store.isOpen()).toBe(false)
      store.close()
    })
  })

  void describe('lookup', () => {
    it('should return "trusted" when key matches stored key', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      const result = store.lookup('server1.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519)

      expect(result.status).toBe('trusted')
      expect(result.storedKey).toBe(TEST_KEY_ED25519)
      store.close()
    })

    it('should return "mismatch" when key differs from stored key', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      const result = store.lookup('server1.example.com', 22, 'ssh-ed25519', 'DIFFERENT_KEY_DATA')

      expect(result.status).toBe('mismatch')
      expect(result.storedKey).toBe(TEST_KEY_ED25519)
      store.close()
    })

    it('should return "unknown" when no key stored for host/port/algorithm', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      const result = store.lookup('unknown-host.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519)

      expect(result.status).toBe('unknown')
      expect(result.storedKey).toBeUndefined()
      store.close()
    })

    it('should return "unknown" when db is not open', () => {
      const store = new HostKeyStore('/nonexistent/path/hostkeys.db')

      const result = store.lookup('server1.example.com', 22, 'ssh-ed25519', TEST_KEY_ED25519)

      expect(result.status).toBe('unknown')
      expect(result.storedKey).toBeUndefined()
      store.close()
    })

    it('should distinguish by port', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      // server2 key is on port 2222
      const result22 = store.lookup('server2.example.com', 22, 'ecdsa-sha2-nistp256', TEST_KEY_ECDSA)
      const result2222 = store.lookup('server2.example.com', 2222, 'ecdsa-sha2-nistp256', TEST_KEY_ECDSA)

      expect(result22.status).toBe('unknown')
      expect(result2222.status).toBe('trusted')
      store.close()
    })

    it('should distinguish by algorithm', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      // server1 has ssh-ed25519 and ssh-rsa, but not ecdsa
      const resultEcdsa = store.lookup('server1.example.com', 22, 'ecdsa-sha2-nistp256', 'some-key')

      expect(resultEcdsa.status).toBe('unknown')
      store.close()
    })

    it('should return stored key info without presentedKey', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      const result = store.lookup('server1.example.com', 22, 'ssh-ed25519')

      expect(result.status).toBe('trusted')
      expect(result.storedKey).toBe(TEST_KEY_ED25519)
      store.close()
    })

    it('should return "unknown" without presentedKey when no record exists', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      const result = store.lookup('unknown-host.example.com', 22, 'ssh-ed25519')

      expect(result.status).toBe('unknown')
      store.close()
    })
  })

  void describe('getAll', () => {
    it('should return all keys for a host/port', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      const keys = store.getAll('server1.example.com', 22)

      expect(keys).toHaveLength(2)
      const algorithms = keys.map(k => k.algorithm).sort()
      expect(algorithms).toEqual(['ssh-ed25519', 'ssh-rsa'])
      store.close()
    })

    it('should return empty array when no keys found', () => {
      seedTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      const keys = store.getAll('unknown-host.example.com', 22)

      expect(keys).toEqual([])
      store.close()
    })

    it('should return empty array when db is not open', () => {
      const store = new HostKeyStore('/nonexistent/path/hostkeys.db')

      const keys = store.getAll('server1.example.com', 22)

      expect(keys).toEqual([])
      store.close()
    })
  })

  void describe('close', () => {
    it('should close the database', () => {
      createTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      expect(store.isOpen()).toBe(true)
      store.close()
      expect(store.isOpen()).toBe(false)
    })

    it('should be safe to call close multiple times', () => {
      createTestDb(ctx.dbPath)
      const store = new HostKeyStore(ctx.dbPath)

      store.close()
      store.close() // Should not throw
      expect(store.isOpen()).toBe(false)
    })

    it('should be safe to call close when db was never opened', () => {
      const store = new HostKeyStore('/nonexistent/path/hostkeys.db')

      store.close() // Should not throw
      expect(store.isOpen()).toBe(false)
    })
  })
})
