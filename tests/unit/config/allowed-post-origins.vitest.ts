// tests/unit/config/allowed-post-origins.vitest.ts
// http.allowedPostOrigins: schema validation and env var mapping (#580)

import { describe, it, expect } from 'vitest'
import { validateConfigSchema } from '../../../app/utils/schema-validator.js'
import { createDefaultConfig, processConfig } from '../../../app/config/config-processor.js'
import { mapEnvironmentVariables } from '../../../app/config/env-mapper.js'
import type { Config } from '../../../app/types/config.js'
import { TEST_SECRET_123 } from '../../test-constants.js'

const withOrigins = (allowedPostOrigins: string[]): Config => {
  const cfg = createDefaultConfig(TEST_SECRET_123)
  return { ...cfg, http: { ...cfg.http, allowedPostOrigins } }
}

describe('http.allowedPostOrigins schema', () => {
  it('is optional', () => {
    const result = validateConfigSchema(createDefaultConfig(TEST_SECRET_123))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.http.allowedPostOrigins).toBeUndefined()
    }
  })

  it('stores entries in canonical form', () => {
    const result = validateConfigSchema(withOrigins([
      'https://portal.example.com/',
      'HTTPS://Portal2.Example.com:443',
      'http://intranet.example:8080'
    ]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.http.allowedPostOrigins).toEqual([
        'https://portal.example.com',
        'https://portal2.example.com',
        'http://intranet.example:8080'
      ])
    }
  })

  it.each([
    'https://portal.example.com/login',
    'https://*.example.com',
    'null',
    'ftp://x'
  ])('fails validation for %s and names the entry', (entry) => {
    const result = validateConfigSchema(withOrigins(['https://ok.example', entry]))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toHaveLength(1)
      expect(result.error[0]?.path).toBe('http.allowedPostOrigins.1')
      expect(result.error[0]?.message).toContain(JSON.stringify(entry))
    }
  })

  it('surfaces the bad entry in the startup error message', () => {
    const cfg = createDefaultConfig(TEST_SECRET_123)
    const result = processConfig(cfg, { http: { origins: ['*:*'], allowedPostOrigins: ['https://portal.example.com/login'] } })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('http.allowedPostOrigins.0')
      expect(result.error.message).toContain('"https://portal.example.com/login"')
    }
  })
})

describe('WEBSSH2_HTTP_ALLOWED_POST_ORIGINS', () => {
  it('maps a comma-separated list onto http.allowedPostOrigins', () => {
    const result = mapEnvironmentVariables({
      WEBSSH2_HTTP_ALLOWED_POST_ORIGINS: 'https://portal.example.com, https://sso.example.com:8443'
    })
    expect(result).toEqual({
      http: { allowedPostOrigins: ['https://portal.example.com', 'https://sso.example.com:8443'] }
    })
  })

  it('maps an empty value to an empty list', () => {
    expect(mapEnvironmentVariables({ WEBSSH2_HTTP_ALLOWED_POST_ORIGINS: '' }))
      .toEqual({ http: { allowedPostOrigins: [] } })
  })
})
