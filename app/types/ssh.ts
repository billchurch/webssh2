// app/types/ssh.ts
// Shared SSH connection type definitions

import type { EventEmitter } from 'events'
import type { Config } from './config.js'

/**
 * SSH Connection Constructor Type
 * Defines the interface for SSH connection implementations
 */
export type SSHCtor = new (config: Config) => {
  connect: (creds: Record<string, unknown>) => Promise<unknown>
  shell: (
    options: {
      term?: string | null
      rows?: number
      cols?: number
      width?: number
      height?: number
    },
    env?: Record<string, string> | null
  ) => Promise<
    EventEmitter & { write?: (d: unknown) => void; end?: () => void; stderr?: EventEmitter }
  >
  exec: (
    command: string,
    options: {
      pty?: boolean
      term?: string
      rows?: number
      cols?: number
      width?: number
      height?: number
    },
    env?: Record<string, string>
  ) => Promise<
    EventEmitter & {
      write?: (d: unknown) => void
      stderr?: EventEmitter
      signal?: (s: string) => void
      close?: () => void
    }
  >
  resizeTerminal?: (rows: number | null, cols: number | null) => void
  end?: () => void
}