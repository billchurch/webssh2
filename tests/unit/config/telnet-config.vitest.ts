// tests/unit/config/telnet-config.vitest.ts
// Tests for telnet default configuration

import { describe, it, expect } from 'vitest'
import { createCompleteDefaultConfig } from '../../../app/config/default-config.js'

describe('telnet default config', () => {
  it('should include telnet config with defaults', () => {
    const config = createCompleteDefaultConfig('test-secret')
    expect(config.telnet).toBeDefined()
    expect(config.telnet?.enabled).toBe(false)
    expect(config.telnet?.defaultPort).toBe(23)
    expect(config.telnet?.term).toBe('vt100')
    expect(config.telnet?.timeout).toBe(30_000)
  })

  it('should have auth config with regex patterns', () => {
    const config = createCompleteDefaultConfig('test-secret')
    expect(config.telnet?.auth.loginPrompt).toBe('login:\\s*$')
    expect(config.telnet?.auth.passwordPrompt).toBe('[Pp]assword:\\s*$')
    expect(config.telnet?.auth.failurePattern).toBe('Login incorrect|Access denied|Login failed')
    expect(config.telnet?.auth.expectTimeout).toBe(10_000)
  })

  it('should deep clone telnet config', () => {
    const config1 = createCompleteDefaultConfig('test-secret')
    const config2 = createCompleteDefaultConfig('test-secret')
    expect(config1.telnet).not.toBe(config2.telnet)
    expect(config1.telnet?.auth).not.toBe(config2.telnet?.auth)
    expect(config1.telnet?.allowedSubnets).not.toBe(config2.telnet?.allowedSubnets)
  })
})
