import { describe, it, expect } from 'vitest'
import { extractCspReport } from '../../../app/security/csp-report.js'

describe('extractCspReport', () => {
  it('extracts whitelisted fields from a legacy csp-report body', () => {
    const r = extractCspReport({
      'csp-report': {
        'document-uri': 'https://gw/ssh',
        'violated-directive': 'script-src',
        'blocked-uri': 'inline',
        disposition: 'enforce',
        'script-sample': 'window.webssh2Config = null;'
      }
    })
    expect(r).toMatchObject({
      directive: 'script-src',
      blockedUri: 'inline',
      disposition: 'enforce',
      documentUri: 'https://gw/ssh'
    })
  })

  it('supports the Reporting-API body shape ({ body: {...} })', () => {
    const r = extractCspReport({ body: { effectiveDirective: 'img-src', blockedURL: 'https://x', documentURL: 'https://gw' } })
    expect(r.directive).toBe('img-src')
    expect(r.blockedUri).toBe('https://x')
    expect(r.documentUri).toBe('https://gw')
  })

  it('strips CR/LF/control chars to prevent log forging', () => {
    const r = extractCspReport({ 'csp-report': { 'blocked-uri': 'a\r\nFAKE LOG LINE' } })
    expect(r.blockedUri).toBe('aFAKE LOG LINE')
  })

  it('truncates over-long fields', () => {
    const long = 'x'.repeat(2000)
    const r = extractCspReport({ 'csp-report': { 'document-uri': long } })
    expect(r.documentUri!.length).toBe(512)
  })

  it('truncates script-sample to 80 chars', () => {
    const r = extractCspReport({ 'csp-report': { 'script-sample': 'y'.repeat(500) } })
    expect(r.scriptSample!.length).toBe(80)
  })

  it('ignores non-string fields', () => {
    const r = extractCspReport({ 'csp-report': { 'blocked-uri': { nested: 'obj' }, 'document-uri': 123 } })
    expect(r.blockedUri).toBeUndefined()
    expect(r.documentUri).toBeUndefined()
  })

  it('returns empty object for non-object / missing report', () => {
    expect(extractCspReport(null)).toEqual({})
    expect(extractCspReport(undefined)).toEqual({})
    expect(extractCspReport('string')).toEqual({})
    expect(extractCspReport([])).toEqual({})
    expect(extractCspReport({})).toEqual({})
  })
})
