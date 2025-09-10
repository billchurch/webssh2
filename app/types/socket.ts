// app/types/socket.ts

import type { Request } from 'express'
import type { SessionData } from './express.js'
import type { SSHCredentials } from './config.js'

export interface SocketQuery {
  header?: string
  headerBackground?: string
  headerStyle?: string
  [key: string]: string | string[] | undefined
}

export interface SocketHandshake {
  query: SocketQuery
  headers: Record<string, string | string[]>
  time: string
  address: string
  xdomain: boolean
  secure: boolean
  issued: number
  url: string
  auth: Record<string, unknown>
  [key: string]: unknown
}

export interface WebSSH2SocketRequest extends Request {
  session: Request['session'] & SessionData & {
    envVars?: Record<string, string>
  }
}

export interface WebSSH2Socket {
  id: string
  handshake: SocketHandshake
  request: WebSSH2SocketRequest
  emit: (event: string, ...args: unknown[]) => boolean
  on: (event: string, listener: (...args: unknown[]) => void) => WebSSH2Socket
  once: (event: string, listener: (...args: unknown[]) => void) => WebSSH2Socket
  off: (event: string, listener: (...args: unknown[]) => void) => WebSSH2Socket
  disconnect: (close?: boolean) => WebSSH2Socket
}

export interface TerminalData {
  term?: string
  rows?: number | string
  cols?: number | string
}

export interface ResizeData {
  rows: number | string
  cols: number | string
}

export interface ExecPayload {
  command: string
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
  timeoutMs?: number
}

export interface ExecExitData {
  code: number | null
  signal: string | null
}

export interface ExecStreamData {
  type: 'stdout' | 'stderr'
  data: string
}

export interface AuthenticationData {
  action: 'request_auth' | 'auth_result' | 'keyboard-interactive' | 'reauth'
  success?: boolean
  message?: string
  name?: string
  instructions?: string
  prompts?: Array<{
    prompt: string
    echo: boolean
  }>
  responses?: string[]
}

export interface PermissionsData {
  autoLog: boolean
  allowReplay: boolean
  allowReconnect: boolean
  allowReauth: boolean
}

export interface UpdateUIData {
  element: string
  value: unknown
}

export interface KeyboardInteractiveData {
  name: string
  instructions: string
  prompts: Array<{
    prompt: string
    echo: boolean
  }>
}

export interface SSHStream {
  write: (data: string | Buffer) => boolean
  on: (event: string, callback: (...args: unknown[]) => void) => void
  signal?: (signal: string) => void
  close?: () => void
  stderr?: {
    on: (event: string, callback: (...args: unknown[]) => void) => void
  }
}

export interface ShellOptions {
  term: string
  cols: number
  rows: number
}

export interface ExecOptions {
  pty: boolean
  term: string
  cols: number
  rows: number
}

export interface SSHConnectionInterface {
  on: (event: string, callback: (...args: unknown[]) => void) => void
  emit: (event: string, ...args: unknown[]) => void
  connect: (credentials: SSHCredentials) => Promise<void>
  shell: (options: ShellOptions, envVars?: Record<string, string> | null) => Promise<SSHStream>
  exec: (command: string, options: ExecOptions, envVars?: Record<string, string> | null) => Promise<SSHStream>
  resizeTerminal?: (rows: number, cols: number) => void
  end: () => void
  stream?: SSHStream
}

export type SSHConnectionClass = new (config: { ssh: unknown }) => SSHConnectionInterface

export interface WebSSH2Server {
  on(event: 'connection', listener: (socket: WebSSH2Socket) => void): WebSSH2Server
}