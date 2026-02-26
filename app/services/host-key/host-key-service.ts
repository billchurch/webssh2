// app/services/host-key/host-key-service.ts
// Host key verification service

import crypto from 'node:crypto'
import type { HostKeyVerificationConfig } from '../../types/config.js'
import { HostKeyStore, type HostKeyLookupResult } from './host-key-store.js'

/**
 * Service coordinating host key verification using server-side
 * and/or client-side stores based on configuration.
 */
export class HostKeyService {
  private readonly config: HostKeyVerificationConfig
  private store: HostKeyStore | null = null

  constructor(config: HostKeyVerificationConfig) {
    this.config = config

    if (config.serverStore.enabled) {
      this.store = new HostKeyStore(config.serverStore.dbPath)
    }
  }

  /**
   * Whether host key verification is enabled
   */
  get isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * Whether the server-side store is enabled
   */
  get serverStoreEnabled(): boolean {
    return this.config.serverStore.enabled
  }

  /**
   * Whether the client-side store is enabled
   */
  get clientStoreEnabled(): boolean {
    return this.config.clientStore.enabled
  }

  /**
   * Action to take when an unknown key is encountered
   */
  get unknownKeyAction(): 'prompt' | 'alert' | 'reject' {
    return this.config.unknownKeyAction
  }

  /**
   * Look up a host key in the server-side store.
   * Returns "unknown" if the server store is not enabled.
   */
  serverLookup(
    host: string,
    port: number,
    algorithm: string,
    presentedKey: string
  ): HostKeyLookupResult {
    if (this.store === null) {
      return { status: 'unknown' }
    }

    return this.store.lookup(host, port, algorithm, presentedKey)
  }

  /**
   * Compute a SHA-256 fingerprint of a base64-encoded public key.
   * Returns "SHA256:<base64hash>" format matching OpenSSH conventions.
   */
  static computeFingerprint(base64Key: string): string {
    const keyBytes = Buffer.from(base64Key, 'base64')
    const hash = crypto.createHash('sha256').update(keyBytes).digest('base64')
    return `SHA256:${hash}`
  }

  /**
   * Close the underlying store. Safe to call multiple times.
   */
  close(): void {
    if (this.store !== null) {
      this.store.close()
      this.store = null
    }
  }
}
