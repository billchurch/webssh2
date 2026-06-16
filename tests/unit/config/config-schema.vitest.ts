// tests/unit/config/config-schema.vitest.ts
// Tests for CspSchema in the Zod config schema

import { describe, it, expect } from 'vitest'
import { validateConfigSchema } from '../../../app/utils/schema-validator.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { TEST_SECRET_123 } from '../../test-constants.js'

describe('csp config schema', () => {
  it('preserves the csp section through validation (not stripped)', () => {
    const cfg = createDefaultConfig(TEST_SECRET_123)
    const result = validateConfigSchema(cfg)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.csp).toEqual({
        mode: 'report-only',
        reportUri: '/ssh/csp-report',
        connectSrc: [],
        frameAncestors: ['none'],
      })
    }
  })

  it('rejects an invalid csp.mode', () => {
    const cfg = {
      ...createDefaultConfig(TEST_SECRET_123),
      csp: { mode: 'strict', reportUri: '/x', connectSrc: [], frameAncestors: ['none'] },
    }
    const result = validateConfigSchema(cfg)
    expect(result.ok).toBe(false)
  })

  it('normalizes a trailing slash on reportUri', () => {
    const cfg = {
      ...createDefaultConfig(TEST_SECRET_123),
      csp: {
        mode: 'report-only',
        reportUri: '/ssh/csp-report/',
        connectSrc: [],
        frameAncestors: ['none'],
      },
    }
    const result = validateConfigSchema(cfg)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.csp.reportUri).toBe('/ssh/csp-report')
    }
  })

  it('default config with csp_violation rate-limit survives validation', () => {
    const cfg = createDefaultConfig(TEST_SECRET_123)
    const result = validateConfigSchema(cfg)
    expect(result.ok).toBe(true)
    if (result.ok) {
      const rules = result.value.logging?.controls?.rateLimit?.rules ?? []
      expect(rules.some((r) => r.target === 'csp_violation' && r.limit === 60)).toBe(true)
    }
  })
})
