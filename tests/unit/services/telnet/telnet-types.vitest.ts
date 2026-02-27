import { describe, it, expect } from 'vitest'
import { TELNET_DEFAULTS } from '../../../../app/constants/core.js'
import type { ProtocolService, ProtocolConnection, TelnetConnectionConfig } from '../../../../app/services/interfaces.js'

describe('telnet types and constants', () => {
  it('should have telnet defaults', () => {
    expect(TELNET_DEFAULTS.PORT).toBe(23)
    expect(TELNET_DEFAULTS.TIMEOUT_MS).toBe(30_000)
    expect(TELNET_DEFAULTS.TERM).toBe('vt100')
    expect(TELNET_DEFAULTS.IO_PATH).toBe('/telnet/socket.io')
  })

  it('should have telnet auth defaults', () => {
    expect(TELNET_DEFAULTS.LOGIN_PROMPT).toBe('login:\\s*$')
    expect(TELNET_DEFAULTS.PASSWORD_PROMPT).toBe('[Pp]assword:\\s*$')
    expect(TELNET_DEFAULTS.FAILURE_PATTERN).toBe('Login incorrect|Access denied|Login failed')
    expect(TELNET_DEFAULTS.EXPECT_TIMEOUT_MS).toBe(10_000)
  })

  // Type-level assertions: these compile only if the types are correctly defined
  it('should allow ProtocolConnection to be typed correctly', () => {
    const connection: ProtocolConnection = {
      id: 'conn-1' as ProtocolConnection['id'],
      sessionId: 'sess-1' as ProtocolConnection['sessionId'],
      protocol: 'telnet',
      status: 'connected',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      host: 'example.com',
      port: 23,
    }
    expect(connection.protocol).toBe('telnet')
    expect(connection.status).toBe('connected')
  })

  it('should allow TelnetConnectionConfig to be typed correctly', () => {
    const config: TelnetConnectionConfig = {
      sessionId: 'sess-1' as TelnetConnectionConfig['sessionId'],
      host: 'example.com',
      port: 23,
      timeout: 30_000,
      term: 'vt100',
    }
    expect(config.host).toBe('example.com')
    expect(config.port).toBe(23)
  })

  // Compile-time check that ProtocolService has the expected shape
  it('should define ProtocolService interface shape', () => {
    // This test validates at compile time that the interface exists with the right methods.
    // At runtime we just verify the type import resolved (non-null module).
    const methods: Array<keyof ProtocolService> = [
      'connect',
      'shell',
      'resize',
      'disconnect',
      'getConnectionStatus',
    ]
    expect(methods).toHaveLength(5)
  })
})
