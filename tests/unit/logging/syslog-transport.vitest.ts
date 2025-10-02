import type { Socket } from 'node:net'
import { Duplex } from 'node:stream'
import type { BufferEncoding } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { createSyslogTransport } from '../../../app/logging/syslog-transport.js'

const SAMPLE_PAYLOAD = JSON.stringify({
  ts: '2025-03-04T05:06:07.890Z',
  level: 'info',
  event: 'session_start',
  session_id: 'session-test'
})

class MemorySocket extends Duplex {
  private readonly onWrite: (chunk: string) => void

  constructor(onWrite: (chunk: string) => void) {
    super()
    this.onWrite = onWrite
    process.nextTick(() => {
      this.emit('connect')
    })
  }

  _read(): void {}

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.onWrite(chunk.toString('utf8'))
    this.emit('drain')
    callback()
  }
}

describe('syslog transport', () => {
  it('forwards structured logs to syslog collector', async () => {
    const frames: string[] = []
    const socketFactory = (): Socket => new MemorySocket((data) => frames.push(data)) as unknown as Socket

    const transportResult = createSyslogTransport({
      host: 'syslog.example.com',
      port: 6514,
      appName: 'webssh2-test',
      includeJson: true,
      flushIntervalMs: 5,
      bufferSize: 10,
      socketFactory
    })

    expect(transportResult.ok).toBe(true)
    if (!transportResult.ok) {
      return
    }

    const publishResult = transportResult.value.publish(SAMPLE_PAYLOAD)
    expect(publishResult.ok).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(frames.length).toBeGreaterThanOrEqual(1)
    const frame = frames[0]
    const spaceIndex = frame.indexOf(' ')
    expect(spaceIndex).toBeGreaterThan(0)

    const announcedLength = Number.parseInt(frame.slice(0, spaceIndex), 10)
    const message = frame.slice(spaceIndex + 1)

    expect(Buffer.byteLength(message, 'utf8')).toBe(announcedLength)
    expect(message).toContain('session_start')
    expect(message).toContain('webssh2-test')
    expect(message).toContain(SAMPLE_PAYLOAD)
  })
})
