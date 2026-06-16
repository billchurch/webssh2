import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG_BASE } from '../../../app/config/default-config.js'

describe('csp defaults', () => {
  it('defaults to report-only with the canonical report path', () => {
    expect(DEFAULT_CONFIG_BASE.csp).toEqual({
      mode: 'report-only',
      reportUri: '/ssh/csp-report',
      connectSrc: [],
      frameAncestors: ['none']
    })
  })
})
