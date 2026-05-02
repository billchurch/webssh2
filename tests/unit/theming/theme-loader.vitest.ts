import { describe, expect, it } from 'vitest'
import { loadAdditionalThemes } from '../../../app/services/theming/theme-loader.js'

const builtinNames = ['Default', 'Dracula']

describe('loadAdditionalThemes', () => {
  it('returns valid subset when some entries fail', () => {
    const raw = [
      { name: 'Good', colors: { background: '#111111' } },
      { name: '</script>', colors: {} },
      { name: 'AlsoGood', colors: { foreground: '#222222' } }
    ]
    const result = loadAdditionalThemes(raw, {
      source: 'config.json',
      builtinNames
    })
    expect(result.valid.map((t) => t.name)).toEqual(['Good', 'AlsoGood'])
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]?.path).toContain('[1]')
  })

  it('handles empty input', () => {
    const result = loadAdditionalThemes([], { source: 'env', builtinNames })
    expect(result.valid).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('rejects collisions with built-ins (case-insensitive)', () => {
    const result = loadAdditionalThemes(
      [{ name: 'dracula', colors: {} }],
      { source: 'config.json', builtinNames }
    )
    expect(result.valid).toEqual([])
    expect(result.warnings[0]?.reason).toContain('collide')
  })

  it('does not throw on garbage input', () => {
    expect(() =>
      loadAdditionalThemes(
        [null, 'string', 42, [], { name: 'good', colors: {} }],
        { source: 'env', builtinNames }
      )
    ).not.toThrow()
  })
})
