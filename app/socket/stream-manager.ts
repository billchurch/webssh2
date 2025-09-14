// app/socket/stream-manager.ts
// Stream management for SSH connections

import type { EventEmitter } from 'events'
import type { Socket } from 'socket.io'
import { createNamespacedDebug } from '../logger.js'

const debug = createNamespacedDebug('socket:stream')

export interface StreamWithControls extends EventEmitter {
  write?: (data: unknown) => void
  end?: () => void
  stderr?: EventEmitter
  signal?: (signal: string) => void
  close?: () => void
  setWindow?: (...args: unknown[]) => void
}

/**
 * Manages SSH stream operations
 */
export class StreamManager {
  private stream: StreamWithControls | null = null
  private onClientData: ((chunk: unknown) => void) | null = null

  constructor(private readonly socket: Socket) {}

  /**
   * Set the current stream
   */
  setStream(stream: StreamWithControls): void {
    this.stream = stream
    this.setupStreamHandlers(stream)
  }

  /**
   * Setup stream event handlers
   */
  private setupStreamHandlers(stream: StreamWithControls): void {
    stream.on('data', (data: unknown) => {
      this.socket.emit('data', data)
    })

    stream.on('close', (code: unknown, signal: unknown) => {
      debug(`Stream closed - code: ${String(code)}, signal: ${String(signal)}`)
      this.socket.emit('sshexit', { code, signal })
    })

    if (stream.stderr != null) {
      stream.stderr.on('data', (data: unknown) => {
        this.socket.emit('data', data)
      })
    }
  }

  /**
   * Write data to stream
   */
  write(data: unknown): boolean {
    if (this.stream?.write != null) {
      this.stream.write(data)
      return true
    }
    return false
  }

  /**
   * Resize terminal window
   */
  resize(cols: number, rows: number): boolean {
    if (this.stream?.setWindow != null) {
      this.stream.setWindow(rows, cols, 0, 0)
      return true
    }
    return false
  }

  /**
   * Send signal to stream
   */
  signal(signal: string): boolean {
    if (this.stream?.signal != null) {
      this.stream.signal(signal)
      return true
    }
    return false
  }

  /**
   * End the stream
   */
  end(): void {
    if (this.stream?.end != null) {
      this.stream.end()
    }
  }

  /**
   * Close the stream
   */
  close(): void {
    if (this.stream?.close != null) {
      this.stream.close()
    }
  }

  /**
   * Set client data handler
   */
  setClientDataHandler(handler: (chunk: unknown) => void): void {
    this.onClientData = handler
  }

  /**
   * Get client data handler
   */
  getClientDataHandler(): ((chunk: unknown) => void) | null {
    return this.onClientData
  }

  /**
   * Check if stream is active
   */
  isActive(): boolean {
    return this.stream != null
  }

  /**
   * Clean up stream resources
   */
  cleanup(): void {
    this.end()
    this.stream = null
    this.onClientData = null
  }
}