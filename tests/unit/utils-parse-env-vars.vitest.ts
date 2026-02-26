import { describe, it, expect } from 'vitest'
import { parseEnvVars } from '../../app/validation/index.js'

describe('parseEnvVars', () => {
  it('parses valid pairs', () => {
    const result: Record<string, string> | null = parseEnvVars('FOO:bar,BAR:baz')
    expect(result).toEqual({ FOO: 'bar', BAR: 'baz' })
  })

  it('trims whitespace', () => {
    const result: Record<string, string> | null = parseEnvVars(' FOO : bar , BAR : baz ')
    expect(result).toEqual({ FOO: 'bar', BAR: 'baz' })
  })

  it('rejects invalid keys overall (no valid pairs)', () => {
    const result: Record<string, string> | null = parseEnvVars('foo:bar,A-B:1,1X:2')
    expect(result).toEqual(null)
  })

  it('rejects dangerous values overall (no valid pairs)', () => {
    const result: Record<string, string> | null = parseEnvVars('FOO:bar;rm -rf /,BAR:baz|whoami')
    expect(result).toEqual(null)
  })

  it('ignores malformed entries', () => {
    const result: Record<string, string> | null = parseEnvVars('A,A:, :B,A:B:C')
    expect(result).toEqual(null)
  })

  it('applies key/value length caps and pair cap', () => {
    const longKey = 'A'.repeat(33)
    const longVal = 'v'.repeat(513)
    // Long key/value should be rejected
    const result1: Record<string, string> | null = parseEnvVars(`${longKey}:ok,OK:${longVal},GOOD:yes`)
    expect(result1).toEqual({ GOOD: 'yes' })

    // Pair cap: only first 50 should be kept
    const many = Array.from({ length: 60 }, (_, i) => `K${i}:v${i}`).join(',')
    const out: Record<string, string> | null = parseEnvVars(many)
    expect(out).not.toBeNull()
    if (out !== null) {
      expect(Object.keys(out).length).toBe(50)
      expect(out['K0']).toBe('v0')
      expect(out['K49']).toBe('v49')
      expect(out['K59']).toBeUndefined()
    }
  })
})
