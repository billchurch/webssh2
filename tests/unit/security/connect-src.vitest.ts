import { describe, it, expect } from 'vitest'
import { deriveConnectSrc } from '../../../app/security/connect-src.js'

describe('deriveConnectSrc', () => {
  it("always includes 'self' and excludes wildcard CORS origins", () => {
    const r = deriveConnectSrc(['*:*'], [], true)
    expect(r.sources).toEqual(["'self'"])
    expect(r.wildcard).toBe(true)
  })

  it('translates a concrete host:port origin to wss+https sources', () => {
    const r = deriveConnectSrc(['gw.example:8443'], [], true)
    expect(r.sources).toEqual(["'self'", 'https://gw.example:8443', 'wss://gw.example:8443'])
    expect(r.wildcard).toBe(false)
  })

  it('adds ws/http variants for non-secure deployments', () => {
    const r = deriveConnectSrc(['gw.example:8080'], [], false)
    expect(r.sources).toContain('ws://gw.example:8080')
    expect(r.sources).toContain('http://gw.example:8080')
  })

  it('passes through an origin that already has a scheme', () => {
    const r = deriveConnectSrc(['https://gw.example'], [], true)
    expect(r.sources).toContain('https://gw.example')
  })

  it('appends operator extras and de-duplicates', () => {
    const r = deriveConnectSrc(['gw.example:8443'], ['wss://gw.example:8443', 'https://x.example'], true)
    expect(r.sources.filter((s) => s === 'wss://gw.example:8443')).toHaveLength(1)
    expect(r.sources).toContain('https://x.example')
  })

  it('never emits a raw *:* token', () => {
    const r = deriveConnectSrc(['*:*', 'gw.example:8443'], [], true)
    expect(r.sources).not.toContain('*:*')
    expect(r.wildcard).toBe(true)
  })

  it('drops every wildcard variant, leaving only self', () => {
    const r = deriveConnectSrc(['*:*', '*', '*.foo.com'], [], true)
    expect(r.sources).toEqual(["'self'"])
    expect(r.wildcard).toBe(true)
  })

  it('skips empty-string and whitespace-only CORS origins', () => {
    const empty = deriveConnectSrc([''], [], true)
    expect(empty.sources).toEqual(["'self'"])
    expect(empty.wildcard).toBe(false)

    const blank = deriveConnectSrc(['   '], [], true)
    expect(blank.sources).toEqual(["'self'"])
    expect(blank.wildcard).toBe(false)
  })

  it('drops a bare wildcard and flags it', () => {
    const r = deriveConnectSrc(['*'], [], true)
    expect(r.sources).toEqual(["'self'"])
    expect(r.wildcard).toBe(true)
  })

  it('rejects a non-network scheme origin', () => {
    const r = deriveConnectSrc(['javascript://evil'], [], true)
    expect(r.sources).not.toContain('javascript://evil')
    expect(r.sources).toEqual(["'self'"])
  })

  it('passes operator extras through verbatim, including intentional wildcards', () => {
    const r = deriveConnectSrc([], ['*.internal.example'], true)
    expect(r.sources).toContain('*.internal.example')
    expect(r.wildcard).toBe(false)
  })

  it('drops a CORS origin containing CR/LF control chars', () => {
    const r = deriveConnectSrc(['host.example:8080\r\nX: y'], [], true)
    expect(r.sources).not.toContain('host.example:8080\r\nX: y')
    expect(r.sources).toEqual(["'self'"])
  })
})
