// tests/unit/security/post-origin.vitest.ts
// Pure decision rule for the credential POST origin check (#580)

import { describe, it, expect } from 'vitest'
import {
  evaluatePostOrigin,
  isPostOriginCheckActive,
  normalizeAllowedPostOrigin,
  type PostOriginPolicy,
  type PostOriginRequest
} from '../../../app/security/post-origin.js'
import { TEST_NETWORK } from '../../test-constants.js'

const PORTAL = 'https://portal.example.com'
const PROXY_IP = TEST_NETWORK.FORWARDED_IP

const policy = (overrides: Partial<PostOriginPolicy> = {}): PostOriginPolicy => ({
  allowedOrigins: [PORTAL],
  ssoEnabled: false,
  trustedProxies: [],
  ...overrides
})

const request = (overrides: Partial<PostOriginRequest> = {}): PostOriginRequest => ({
  origin: undefined,
  secFetchSite: undefined,
  peerIp: '192.0.2.10',
  hasSsoHeader: false,
  ...overrides
})

describe('normalizeAllowedPostOrigin', () => {
  it.each([
    [PORTAL, PORTAL],
    [`${PORTAL}/`, PORTAL],
    ['HTTPS://Portal.Example.com:443', PORTAL],
    ['http://portal.example.com:80', 'http://portal.example.com'],
    ['https://portal.example.com:8443', 'https://portal.example.com:8443'],
    ['http://[::1]:8080', 'http://[::1]:8080'],
    ['http://127.0.0.1:2222/', 'http://127.0.0.1:2222']
  ])('accepts %s as %s', (entry, expected) => {
    expect(normalizeAllowedPostOrigin(entry)).toEqual({ ok: true, value: expected })
  })

  it.each([
    ['https://portal.example.com/login', 'bare origin'],
    ['https://portal.example.com//', 'bare origin'],
    ['https://portal.example.com?x=1', 'bare origin'],
    ['https://portal.example.com#frag', 'bare origin'],
    ['https://user:pw@portal.example.com', 'bare origin'],
    [' https://portal.example.com', 'bare origin'],
    ['https://*.example.com', 'wildcards'],
    ['*', 'wildcards'],
    ['null', 'null'],
    ['NULL', 'null'],
    ['ftp://x', 'http or https'], // NOSONAR - insecure scheme the validator must reject
    ['javascript:alert(1)', 'http or https'],
    ['portal.example.com', 'scheme://host'],
    ['', 'scheme://host']
  ])('rejects %s and names it in the error', (entry, reason) => {
    const result = normalizeAllowedPostOrigin(entry)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(JSON.stringify(entry))
      expect(result.error).toContain(reason)
    }
  })

  it('escapes control characters and truncates long entries in the error', () => {
    const result = normalizeAllowedPostOrigin(`https://a.example\n${'x'.repeat(500)}`)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).not.toContain('\n')
      expect(result.error.length).toBeLessThan(400)
    }
  })
})

const sso = (enabled: boolean, csrfProtection: boolean): { enabled: boolean; csrfProtection: boolean } =>
  ({ enabled, csrfProtection })

describe('isPostOriginCheckActive', () => {

  it('is off with no allowlist and SSO off', () => {
    expect(isPostOriginCheckActive({ http: {}, sso: sso(false, false) })).toBe(false)
    expect(isPostOriginCheckActive({ http: { allowedPostOrigins: [] }, sso: sso(false, true) })).toBe(false)
    expect(isPostOriginCheckActive({ http: {}, sso: sso(true, false) })).toBe(false)
  })

  it('is on with a non-empty allowlist', () => {
    expect(isPostOriginCheckActive({ http: { allowedPostOrigins: [PORTAL] }, sso: sso(false, false) })).toBe(true)
  })

  it('is on with SSO and csrfProtection both enabled', () => {
    expect(isPostOriginCheckActive({ http: {}, sso: sso(true, true) })).toBe(true)
  })
})

describe('evaluatePostOrigin decision table', () => {
  it('1: accepts Sec-Fetch-Site same-origin', () => {
    expect(evaluatePostOrigin(request({ secFetchSite: 'same-origin', origin: 'https://gw.example' }), policy()))
      .toEqual({ accept: true, step: 'same-origin' })
  })

  it('1: accepts same-origin even with an empty allowlist', () => {
    expect(evaluatePostOrigin(request({ secFetchSite: 'Same-Origin' }), policy({ allowedOrigins: [] })))
      .toEqual({ accept: true, step: 'same-origin' })
  })

  it('2a: rejects Origin null even when cross-site headers say nothing else', () => {
    expect(evaluatePostOrigin(request({ origin: 'null', secFetchSite: 'cross-site' }), policy()))
      .toEqual({ accept: false, step: 'null-origin' })
    expect(evaluatePostOrigin(request({ origin: 'null' }), policy()))
      .toEqual({ accept: false, step: 'null-origin' })
  })

  it('2b: accepts a listed Origin', () => {
    expect(evaluatePostOrigin(request({ origin: PORTAL, secFetchSite: 'cross-site' }), policy()))
      .toEqual({ accept: true, step: 'listed-origin' })
  })

  it('2b: matches ignoring case and the default port', () => {
    expect(evaluatePostOrigin(request({ origin: 'HTTPS://Portal.Example.com:443' }), policy()))
      .toEqual({ accept: true, step: 'listed-origin' })
  })

  it('2c: rejects an unlisted Origin', () => {
    expect(evaluatePostOrigin(request({ origin: 'https://evil.example', secFetchSite: 'cross-site' }), policy()))
      .toEqual({ accept: false, step: 'unlisted-origin' })
  })

  it('2c: rejects a listed host on a different scheme or port', () => {
    expect(evaluatePostOrigin(request({ origin: 'http://portal.example.com' }), policy()).accept).toBe(false)
    expect(evaluatePostOrigin(request({ origin: 'https://portal.example.com:8443' }), policy()).accept).toBe(false)
  })

  it('2c: rejects a malformed Origin', () => {
    expect(evaluatePostOrigin(request({ origin: 'not an origin' }), policy()))
      .toEqual({ accept: false, step: 'unlisted-origin' })
  })

  it('3: accepts a request with neither header', () => {
    expect(evaluatePostOrigin(request(), policy()))
      .toEqual({ accept: true, step: 'no-browser-headers' })
  })

  it.each(['same-site', 'cross-site', 'none'])(
    '4: rejects Sec-Fetch-Site %s without an Origin',
    (secFetchSite) => {
      expect(evaluatePostOrigin(request({ secFetchSite }), policy()))
        .toEqual({ accept: false, step: 'unverified-cross-site' })
    }
  )

  it('4: rejects same-site with an unlisted Origin at step 2c', () => {
    expect(evaluatePostOrigin(request({ secFetchSite: 'same-site', origin: 'https://sub.example.com' }), policy()))
      .toEqual({ accept: false, step: 'unlisted-origin' })
  })
})

describe('evaluatePostOrigin SSO bypasses', () => {
  const crossSite = { origin: 'https://evil.example', secFetchSite: 'cross-site' }

  it('accepts a trusted proxy IP when SSO is enabled', () => {
    expect(evaluatePostOrigin(
      request({ ...crossSite, peerIp: PROXY_IP }),
      policy({ ssoEnabled: true, trustedProxies: [PROXY_IP] })
    )).toEqual({ accept: true, step: 'sso-trusted-proxy' })
  })

  it('accepts SSO headers when SSO is enabled', () => {
    expect(evaluatePostOrigin(
      request({ ...crossSite, hasSsoHeader: true }),
      policy({ ssoEnabled: true })
    )).toEqual({ accept: true, step: 'sso-header' })
  })

  it('ignores both bypasses when SSO is disabled', () => {
    expect(evaluatePostOrigin(
      request({ ...crossSite, peerIp: PROXY_IP, hasSsoHeader: true }),
      policy({ ssoEnabled: false, trustedProxies: [PROXY_IP] })
    )).toEqual({ accept: false, step: 'unlisted-origin' })
  })
})
