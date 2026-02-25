// app/services/host-key/host-key-store.ts
// SQLite-backed read-only host key store

import Database, { type Database as BetterSqlite3Database } from 'better-sqlite3'
import fs from 'node:fs'

/**
 * Result of looking up a host key
 */
export interface HostKeyLookupResult {
  status: 'trusted' | 'mismatch' | 'unknown'
  storedKey?: string
}

/**
 * A stored host key record
 */
export interface StoredHostKey {
  host: string
  port: number
  algorithm: string
  key: string
  addedAt: string
  comment: string | null
}

/**
 * SQLite-backed host key store (read-only).
 *
 * Opens the database in read-only mode. If the file does not exist,
 * the store operates in a degraded mode where all lookups return "unknown".
 */
export class HostKeyStore {
  private db: BetterSqlite3Database | null = null

  constructor(dbPath: string) {
    if (fs.existsSync(dbPath)) {
      this.db = new Database(dbPath, { readonly: true })
    }
  }

  /**
   * Whether the database is currently open
   */
  isOpen(): boolean {
    return this.db !== null
  }

  /**
   * Look up a host key in the store.
   *
   * When presentedKey is provided, compares it to the stored key:
   *   - "trusted"  if the presented key matches the stored key
   *   - "mismatch" if there is a stored key but it differs
   *   - "unknown"  if there is no stored key for this host/port/algorithm
   *
   * When presentedKey is omitted, returns the stored key if present
   * ("trusted") or "unknown" if no record exists.
   */
  lookup(
    host: string,
    port: number,
    algorithm: string,
    presentedKey?: string
  ): HostKeyLookupResult {
    if (this.db === null) {
      return { status: 'unknown' }
    }

    const row = this.db
      .prepare('SELECT key FROM host_keys WHERE host = ? AND port = ? AND algorithm = ?')
      .get(host, port, algorithm) as { key: string } | undefined

    if (row === undefined) {
      return { status: 'unknown' }
    }

    // No presented key means caller just wants to know if we have a record
    if (presentedKey === undefined) {
      return { status: 'trusted', storedKey: row.key }
    }

    if (row.key === presentedKey) {
      return { status: 'trusted', storedKey: row.key }
    }

    return { status: 'mismatch', storedKey: row.key }
  }

  /**
   * Get all stored keys for a given host and port
   */
  getAll(host: string, port: number): StoredHostKey[] {
    if (this.db === null) {
      return []
    }

    const rows = this.db
      .prepare('SELECT host, port, algorithm, key, added_at, comment FROM host_keys WHERE host = ? AND port = ?')
      .all(host, port) as Array<{
        host: string
        port: number
        algorithm: string
        key: string
        added_at: string
        comment: string | null
      }>

    return rows.map(row => ({
      host: row.host,
      port: row.port,
      algorithm: row.algorithm,
      key: row.key,
      addedAt: row.added_at,
      comment: row.comment,
    }))
  }

  /**
   * Close the database connection. Safe to call multiple times.
   */
  close(): void {
    if (this.db !== null) {
      this.db.close()
      this.db = null
    }
  }
}
