import { describe, it, expect } from 'vitest'
import { parseEnvVars } from '../../app/utils'

describe('parseEnvVars', () => {
  it('parses valid pairs', () => {
    expect(parseEnvVars('FOO:bar,BAR:baz')).toEqual({ FOO: 'bar', BAR: 'baz' })
  })

  it('trims whitespace', () => {
    expect(parseEnvVars(' FOO : bar , BAR : baz ')).toEqual({ FOO: 'bar', BAR: 'baz' })
  })

  it('rejects invalid keys overall (no valid pairs)', () => {
    expect(parseEnvVars('foo:bar,A-B:1,1X:2')).toEqual(null)
  })

  it('rejects dangerous values overall (no valid pairs)', () => {
    expect(parseEnvVars('FOO:bar;rm -rf /,BAR:baz|whoami')).toEqual(null)
  })

  it('ignores malformed entries', () => {
    expect(parseEnvVars('A,A:, :B,A:B:C')).toEqual(null)
  })

  it('applies key/value length caps and pair cap', () => {
    const longKey = 'A'.repeat(33)
    const longVal = 'v'.repeat(513)
    // Long key/value should be rejected
    expect(parseEnvVars(`${longKey}:ok,OK:${longVal},GOOD:yes`)).toEqual({ GOOD: 'yes' })

    // Pair cap: only first 50 should be kept
    const many = Array.from({ length: 60 }, (_, i) => `K${i}:v${i}`).join(',')
    const out = parseEnvVars(many)!
    expect(Object.keys(out).length).toBe(50)
    expect(out['K0']).toBe('v0')
    expect(out['K49']).toBe('v49')
    expect(out['K59']).toBeUndefined()
  })
})
