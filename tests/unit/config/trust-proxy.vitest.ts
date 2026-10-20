// tests/unit/config/trust-proxy.vitest.ts
// http.trustProxy: env parsing, entry validation and config schema errors

import { describe, it, expect } from 'vitest'
import {
  isTrustProxyEnabled,
  isValidTrustProxyEntry,
  parseTrustProxyEnv,
} from '../../../app/config/trust-proxy.js'
import { mapEnvironmentVariables } from '../../../app/config/env-mapper.js'
import { createDefaultConfig, processConfig } from '../../../app/config/config-processor.js'
import { TEST_SESSION_SECRET_VALID } from '@tests/test-constants.js'
import type { Config } from '../../../app/types/config.js'

const SECRET: string = TEST_SESSION_SECRET_VALID

const getTrustProxy = (config: Record<string, unknown>): unknown =>
  (config['http'] as Record<string, unknown> | undefined)?.['trustProxy']

function validate(trustProxy: unknown): ReturnType<typeof processConfig> {
  const defaults = createDefaultConfig(SECRET)
  const fileConfig = { http: { origins: ['*:*'], trustProxy } } as unknown as Partial<Config>
  return processConfig(defaults, fileConfig)
}

describe('isTrustProxyEnabled', () => {
  it.each([undefined, false, 0, []])('is off for %j', (value) => {
    expect(isTrustProxyEnabled(value)).toBe(false)
  })

  it.each([true, 1, 2, ['10.0.0.1']])('is on for %j', (value) => { //NOSONAR - test fixture address
    expect(isTrustProxyEnabled(value)).toBe(true)
  })
})

describe('isValidTrustProxyEntry', () => {
  it.each([
    '10.0.0.1', //NOSONAR - test fixture address
    '10.0.0.0/8', //NOSONAR - test fixture address
    '0.0.0.0/1',
    '192.168.1.0/32', //NOSONAR - test fixture address
    '::1',
    'fd00::/8', //NOSONAR - test fixture address
    '2001:db8::/128',
    'loopback',
    'linklocal',
    'uniquelocal',
  ])('accepts %s', (entry) => {
    expect(isValidTrustProxyEntry(entry)).toBe(true)
  })

  it.each([
    '',
    'proxy.example.com',
    'Loopback',
    '10.0.0.256',
    '10.0.0.0/33', //NOSONAR - test fixture address
    '0.0.0.0/0',
    '::/0',
    '10.0.0.0/0', //NOSONAR - test fixture address
    '10.0.0.0/',
    '10.0.0.0/-1',
    '10.0.0.0/8/8',
    '10.0.0.0/255.0.0.0',
    'fd00::/129', //NOSONAR - test fixture address
    '/8',
    ' 10.0.0.1',
  ])('rejects %j', (entry) => {
    expect(isValidTrustProxyEntry(entry)).toBe(false)
  })
})

describe('parseTrustProxyEnv', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['false', false],
    ['0', 0],
    ['2', 2],
    [' 1 ', 1],
    ['10.0.0.1', ['10.0.0.1']], //NOSONAR - test fixture address
    ['10.0.0.1, 10.0.0.0/8,loopback', ['10.0.0.1', '10.0.0.0/8', 'loopback']], //NOSONAR - test fixture address
    ['["10.0.0.1","::1"]', ['10.0.0.1', '::1']], //NOSONAR - test fixture address
    ['yes', ['yes']],
  ])('parses %j', (raw, expected) => {
    expect(parseTrustProxyEnv(raw)).toEqual(expected)
  })

  it.each([
    [',', ['', '']],
    [' , ', ['', '']],
    ['10.0.0.1,,', ['10.0.0.1', '', '']], //NOSONAR - test fixture address
    ['["10.0.0.1"', ['["10.0.0.1"']], //NOSONAR - test fixture address
    ['[10.0.0.1]', ['[10.0.0.1]']], //NOSONAR - test fixture address
    ['[1, true]', ['1', 'true']],
  ])('keeps malformed list %j for the schema to reject', (raw, expected) => {
    expect(parseTrustProxyEnv(raw)).toEqual(expected)
  })

  it.each(['', '   '])('treats %j as unset', (raw) => {
    expect(parseTrustProxyEnv(raw)).toBeUndefined()
  })
})

describe('WEBSSH2_HTTP_TRUST_PROXY mapping', () => {
  it('maps to http.trustProxy', () => {
    expect(getTrustProxy(mapEnvironmentVariables({ WEBSSH2_HTTP_TRUST_PROXY: 'true' }))).toBe(true)
    expect(getTrustProxy(mapEnvironmentVariables({ WEBSSH2_HTTP_TRUST_PROXY: '1' }))).toBe(1)
    expect(
      getTrustProxy(mapEnvironmentVariables({ WEBSSH2_HTTP_TRUST_PROXY: '10.0.0.1,10.1.0.0/16' }))
    ).toEqual(['10.0.0.1', '10.1.0.0/16']) //NOSONAR - test fixture address
  })

  it('leaves http.trustProxy unset when the variable is unset or empty', () => {
    expect(getTrustProxy(mapEnvironmentVariables({}))).toBeUndefined()
    expect(getTrustProxy(mapEnvironmentVariables({ WEBSSH2_HTTP_TRUST_PROXY: '' }))).toBeUndefined()
  })

  it('keeps http.origins alongside it', () => {
    const config = mapEnvironmentVariables({
      WEBSSH2_HTTP_ORIGINS: 'a.example.com',
      WEBSSH2_HTTP_TRUST_PROXY: 'loopback',
    })
    expect(config['http']).toEqual({ origins: ['a.example.com'], trustProxy: ['loopback'] })
  })
})

describe('http.trustProxy schema validation', () => {
  it('leaves trustProxy out of the default config', () => {
    const config = createDefaultConfig(SECRET)
    expect('trustProxy' in config.http).toBe(false)
    const result = processConfig(config)
    expect(result.ok && 'trustProxy' in result.value.http).toBe(false)
  })

  it.each([true, false, 0, 3, [], ['10.0.0.1', '10.0.0.0/8', '::1', 'loopback']])( //NOSONAR - test fixture address
    'accepts %j',
    (value) => {
      const result = validate(value)
      expect(result.ok).toBe(true)
      expect(result.ok && result.value.http.trustProxy).toEqual(value)
    }
  )

  it.each(['0.0.0.0/0', '::/0'])('rejects the /0 range %s', (entry) => {
    const result = validate([entry])
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.message).toContain(`"${entry}"`)
    expect(!result.ok && result.error.message).toContain('prefix 1-32 for IPv4, 1-128 for IPv6')
  })

  it.each([',', ' , ', '10.0.0.1,,', ',10.0.0.1', '["10.0.0.1"', '[1]', '[]x'])( //NOSONAR - test fixture address
    'fails validation for the malformed env value %j',
    (raw) => {
      const envConfig = mapEnvironmentVariables({ WEBSSH2_HTTP_TRUST_PROXY: raw })
      const result = processConfig(createDefaultConfig(SECRET), undefined, envConfig)
      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.message).toContain('http.trustProxy')
    }
  )

  it('accepts an explicit empty JSON list from the env as "trust nothing"', () => {
    const envConfig = mapEnvironmentVariables({ WEBSSH2_HTTP_TRUST_PROXY: '[]' })
    const result = processConfig(createDefaultConfig(SECRET), undefined, envConfig)
    expect(result.ok && result.value.http.trustProxy).toEqual([])
  })

  it('names the bad entry in an address list', () => {
    const result = validate(['10.0.0.1', 'proxy.example.com']) //NOSONAR - test fixture address
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.message).toContain('http.trustProxy')
    expect(!result.ok && result.error.message).toContain('"proxy.example.com"')
  })

  it.each([-1, 1.5, 'true', 'loopback', { hops: 1 }, null])(
    'rejects %j with a clear message',
    (value) => {
      const result = validate(value)
      expect(result.ok).toBe(false)
      expect(!result.ok && result.error.message).toMatch(
        /http\.trustProxy: trustProxy must be true, false, a hop count/
      )
    }
  )
})
