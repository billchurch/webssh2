import { describe, expect, it } from 'vitest'
import { parseBase64JsonArrayEnv } from '../../../app/config/env-parser.js'

describe('parseBase64JsonArrayEnv', () => {
  it('decodes a valid base64 JSON array', () => {
    const json = JSON.stringify([{ name: 'X' }])
    const b64 = Buffer.from(json, 'utf8').toString('base64')
    const result = parseBase64JsonArrayEnv(b64)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual([{ name: 'X' }])
    }
  })

  it('rejects raw oversize before decoding', () => {
    const huge = 'A'.repeat(90_000)
    const result = parseBase64JsonArrayEnv(huge)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('rawOversize')
    }
  })

  it('rejects malformed base64', () => {
    const result = parseBase64JsonArrayEnv('!!!not_base64!!!')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('base64')
    }
  })

  it('rejects JSON that is not an array', () => {
    const b64 = Buffer.from('{"name":"X"}', 'utf8').toString('base64')
    const result = parseBase64JsonArrayEnv(b64)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('notArray')
    }
  })

  it('rejects malformed JSON', () => {
    const b64 = Buffer.from('not json at all', 'utf8').toString('base64')
    const result = parseBase64JsonArrayEnv(b64)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('json')
    }
  })

  it('rejects decoded oversize', () => {
    // 65_510 'A's yields decoded=65_537 bytes (just over 64 KiB) with
    // base64 length 87_384 — safely under the raw cap of ~87_389
    const json = JSON.stringify([{ name: 'X', license: 'A'.repeat(65_510) }])
    const b64 = Buffer.from(json, 'utf8').toString('base64')
    const result = parseBase64JsonArrayEnv(b64)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('oversize')
    }
  })
})
