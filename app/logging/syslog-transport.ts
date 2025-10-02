// app/logging/syslog-transport.ts
// Network transport for forwarding structured logs to RFC 5424 syslog collectors

import net from 'node:net'
import tls from 'node:tls'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { TransportBackpressureError, type LogTransport } from './stdout-transport.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'
import { formatSyslogMessage, type SyslogFormatterOptions } from './syslog-formatter.js'

const DEFAULT_BUFFER_SIZE = 1000
const DEFAULT_FLUSH_INTERVAL_MS = 1000
const DEFAULT_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000

export interface SyslogTlsOptions {
  readonly enabled: boolean
  readonly caFile?: string
  readonly certFile?: string
  readonly keyFile?: string
  readonly rejectUnauthorized?: boolean
}

export interface SyslogTransportOptions {
  readonly host?: string
  readonly port?: number
  readonly appName?: string
  readonly hostname?: string
  readonly facility?: number
  readonly enterpriseId?: number
  readonly includeJson?: boolean
  readonly bufferSize?: number
  readonly flushIntervalMs?: number
  readonly tls?: SyslogTlsOptions
  readonly socketFactory?: () => net.Socket | tls.TLSSocket
}

export function createSyslogTransport(options: SyslogTransportOptions): Result<LogTransport> {
  const validated = validateSyslogOptions(options)
  if (!validated.ok) {
    return validated
  }

  const tlsResult = createTlsCredentials(options.tls)
  if (!tlsResult.ok) {
    return tlsResult
  }

  type BaseSyslogTransportState = Omit<SyslogTransportState, 'tls' | 'socketFactory'>

  const baseState: BaseSyslogTransportState = {
    host: validated.value.host,
    port: validated.value.port,
    formatter: createFormatterOptions(options),
    bufferSize: options.bufferSize ?? DEFAULT_BUFFER_SIZE,
    flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS
  }

  const withTls: Omit<SyslogTransportState, 'socketFactory'> =
    tlsResult.value === undefined ? baseState : { ...baseState, tls: tlsResult.value }

  const state: SyslogTransportState =
    options.socketFactory === undefined
      ? withTls
      : { ...withTls, socketFactory: options.socketFactory }

  const transport = new SyslogTransportImpl(state)

  return ok(transport)
}

interface ValidatedSyslogOptions {
  readonly host: string
  readonly port: number
}

function validateSyslogOptions(
  options: SyslogTransportOptions
): Result<ValidatedSyslogOptions> {
  const host = options.host
  if (typeof host !== 'string' || host.trim() === '') {
    return err(new Error('Syslog host is required when syslog transport is enabled'))
  }

  const port = options.port
  if (typeof port !== 'number' || Number.isNaN(port)) {
    return err(new Error('Syslog port is required when syslog transport is enabled'))
  }

  return ok({ host, port })
}

interface TlsCredentials {
  readonly enabled: boolean
  readonly ca?: Buffer
  readonly cert?: Buffer
  readonly key?: Buffer
  readonly rejectUnauthorized: boolean
}

function createTlsCredentials(options: SyslogTlsOptions | undefined): Result<TlsCredentials | undefined> {
  if (options === undefined || options.enabled !== true) {
    return ok(undefined)
  }

  try {
    const credentials: TlsCredentials = {
      enabled: true,
      rejectUnauthorized: options.rejectUnauthorized ?? true,
      ...(readOptionalFile(options.caFile) ?? {}),
      ...(readOptionalFile(options.certFile, 'cert') ?? {}),
      ...(readOptionalFile(options.keyFile, 'key') ?? {})
    }
    return ok(credentials)
  } catch (error) {
    const failure = error instanceof Error ? error : new Error('Failed to read syslog TLS credentials')
    return err(failure)
  }
}

/* eslint-disable security/detect-non-literal-fs-filename */
function readOptionalFile(
  filePath: string | undefined,
  key: 'ca' | 'cert' | 'key' = 'ca'
): Partial<TlsCredentials> | undefined {
  if (filePath === undefined) {
    return undefined
  }

  const resolved = path.resolve(filePath)
  if (!path.isAbsolute(resolved) || resolved.includes('..')) {
    throw new Error('Syslog TLS credential paths must be absolute without traversal')
  }

  const fileUrl = pathToFileURL(resolved)
  const data = fs.readFileSync(fileUrl)
  return { [key]: data } as Partial<TlsCredentials>
}
/* eslint-enable security/detect-non-literal-fs-filename */

interface SyslogTransportState {
  readonly host: string
  readonly port: number
  readonly formatter: SyslogFormatterOptions
  readonly bufferSize: number
  readonly flushIntervalMs: number
  readonly tls?: TlsCredentials
  readonly socketFactory?: () => net.Socket | tls.TLSSocket
}

class SyslogTransportImpl implements LogTransport {
  private readonly host: string
  private readonly port: number
  private readonly formatter: SyslogFormatterOptions
  private readonly bufferSize: number
  private readonly flushIntervalMs: number
  private readonly tls: TlsCredentials | null
  private readonly socketFactory: (() => net.Socket | tls.TLSSocket) | null

  private readonly queue: string[] = []
  private socket: net.Socket | tls.TLSSocket | null = null
  private connecting = false
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = DEFAULT_RECONNECT_DELAY_MS

  constructor(state: SyslogTransportState) {
    this.host = state.host
    this.port = state.port
    this.formatter = state.formatter
    this.bufferSize = state.bufferSize
    this.flushIntervalMs = state.flushIntervalMs
    this.tls = state.tls ?? null
    this.socketFactory = state.socketFactory ?? null

    this.ensureConnection()
  }

  publish(payload: string): Result<void> {
    const formatted = formatSyslogMessage(payload, this.formatter)
    if (!formatted.ok) {
      return formatted
    }

    if (this.queue.length >= this.bufferSize) {
      return err(new TransportBackpressureError('Syslog transport buffer is full'))
    }

    this.queue.push(frameMessage(formatted.value))
    this.ensureConnection()

    const flushResult = this.flushQueue()
    if (!flushResult.ok) {
      return flushResult
    }

    if (this.queue.length > 0) {
      this.scheduleFlush()
    }

    return ok(undefined)
  }

  flush(): Result<void> {
    return this.flushQueue()
  }

  private ensureConnection(): void {
    if (this.socket !== null || this.connecting) {
      return
    }

    this.connecting = true

    if (this.socketFactory !== null) {
      this.connectUsingFactory()
      return
    }

    if (this.tls?.enabled === true) {
      this.bindSocket(
        tls.connect({
          host: this.host,
          port: this.port,
          rejectUnauthorized: this.tls.rejectUnauthorized,
          ...(this.tls.ca === undefined ? {} : { ca: this.tls.ca }),
          ...(this.tls.cert === undefined ? {} : { cert: this.tls.cert }),
          ...(this.tls.key === undefined ? {} : { key: this.tls.key })
        })
      )
      return
    }

    this.bindSocket(net.connect({ host: this.host, port: this.port }))
  }

  private connectUsingFactory(): void {
    try {
      if (this.socketFactory === null) {
        return
      }
      const createdSocket = this.socketFactory()
      this.bindSocket(createdSocket)
      this.connecting = false
      this.reconnectDelay = DEFAULT_RECONNECT_DELAY_MS
      this.flushQueue()
    } catch (error) {
      this.connecting = false
      const reason = error instanceof Error ? error : new Error(String(error))
      process.stderr.write(`Syslog transport error: ${reason.message}\n`)
    }
  }

  private bindSocket(nextSocket: net.Socket | tls.TLSSocket): void {
    this.socket = nextSocket
    if (nextSocket instanceof tls.TLSSocket) {
      nextSocket.once('secureConnect', () => this.handleConnected(nextSocket))
    } else {
      nextSocket.once('connect', () => this.handleConnected(nextSocket))
    }
    nextSocket.on('error', (error: Error) => this.handleSocketError(error))
    nextSocket.on('close', () => this.handleSocketClose())
    nextSocket.on('drain', () => this.flushQueue())
  }

  private handleConnected(connectedSocket: net.Socket | tls.TLSSocket): void {
    if (this.socket !== connectedSocket) {
      return
    }
    this.connecting = false
    this.reconnectDelay = DEFAULT_RECONNECT_DELAY_MS
    this.flushQueue()
  }

  private handleSocketError(error: Error): void {
    this.connecting = false
    this.socket = null
    if (this.socketFactory === null) {
      this.scheduleReconnect()
    }
    process.stderr.write(`Syslog transport error: ${error.message}\n`)
  }

  private handleSocketClose(): void {
    this.connecting = false
    this.socket = null
    if (this.socketFactory === null) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) {
      return
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.ensureConnection()
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
    }, this.reconnectDelay)
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      return
    }
    this.flushTimer = setInterval(() => {
      if (this.queue.length === 0) {
        if (this.flushTimer !== null) {
          clearInterval(this.flushTimer)
          this.flushTimer = null
        }
        return
      }
      this.flushQueue()
    }, this.flushIntervalMs)
  }

  private flushQueue(): Result<void> {
    if (this.socket === null) {
      this.ensureConnection()
      return ok(undefined)
    }

    while (this.queue.length > 0) {
      const nextPayload = this.queue[0]
      if (nextPayload === undefined) {
        this.queue.shift()
        continue
      }

      const writeOk = this.socket.write(nextPayload)
      if (!writeOk) {
        return ok(undefined)
      }
      this.queue.shift()
    }

    return ok(undefined)
  }
}

function frameMessage(message: string): string {
  const byteLength = Buffer.byteLength(message, 'utf8')
  return `${byteLength} ${message}`
}

function createFormatterOptions(options: SyslogTransportOptions): SyslogFormatterOptions {
  return {
    ...(options.facility === undefined ? {} : { facility: options.facility }),
    ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
    ...(options.appName === undefined ? {} : { appName: options.appName }),
    ...(options.enterpriseId === undefined ? {} : { enterpriseId: options.enterpriseId }),
    ...(options.includeJson === undefined ? {} : { includeJson: options.includeJson })
  }
}
