import { describe, expect, it } from 'vitest'
import {
  validateTheme,
  HEX_COLOR_REGEX
} from '../../../app/services/theming/theme-validator.js'

const validTheme = {
  name: 'Dracula',
  colors: { background: '#282a36', foreground: '#f8f8f2' },
  license: 'MIT',
  source: 'https://draculatheme.com'
}

describe('HEX_COLOR_REGEX', () => {
  it('accepts #rgb, #rrggbb, #rrggbbaa', () => {
    expect(HEX_COLOR_REGEX.test('#abc')).toBe(true)
    expect(HEX_COLOR_REGEX.test('#aabbcc')).toBe(true)
    expect(HEX_COLOR_REGEX.test('#aabbccdd')).toBe(true)
    expect(HEX_COLOR_REGEX.test('#AABBCC')).toBe(true)
  })

  it('rejects #rgba (4-char), 5-char, 7-char, named colors, rgb()', () => {
    expect(HEX_COLOR_REGEX.test('#abcd')).toBe(false)
    expect(HEX_COLOR_REGEX.test('#abcde')).toBe(false)
    expect(HEX_COLOR_REGEX.test('#abcdefg')).toBe(false)
    expect(HEX_COLOR_REGEX.test('red')).toBe(false)
    expect(HEX_COLOR_REGEX.test('rgb(0,0,0)')).toBe(false)
    expect(HEX_COLOR_REGEX.test('transparent')).toBe(false)
  })
})

describe('validateTheme — happy path', () => {
  it('accepts a valid additional theme', () => {
    const result = validateTheme(validTheme, 'additional', { builtinNames: ['Default'] })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('Dracula')
      expect(result.value.colors.background).toBe('#282a36')
      expect(result.value.source).toBe('https://draculatheme.com/')
    }
  })

  it('stores normalized URL.href for source', () => {
    const result = validateTheme(
      { ...validTheme, source: 'https://example.com/path?x=1' },
      'additional',
      { builtinNames: [] }
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.source).toBe('https://example.com/path?x=1')
    }
  })

  it('canonicalizes name (trim + collapse whitespace)', () => {
    const result = validateTheme(
      { ...validTheme, name: '  Corporate   Dark  ' },
      'additional',
      { builtinNames: [] }
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('Corporate Dark')
    }
  })
})

describe('validateTheme — name rejections', () => {
  it('rejects HTML-bait names', () => {
    const r = validateTheme({ ...validTheme, name: '</script>' }, 'additional', { builtinNames: [] })
    expect(r.ok).toBe(false)
  })

  it('rejects reserved sentinels for additional context', () => {
    expect(validateTheme({ ...validTheme, name: 'Default' }, 'additional', { builtinNames: [] }).ok).toBe(false)
    expect(validateTheme({ ...validTheme, name: 'custom' }, 'additional', { builtinNames: [] }).ok).toBe(false)
  })

  it('rejects collisions with built-ins (case-insensitive, NFKC)', () => {
    const r = validateTheme(
      { ...validTheme, name: 'dracula' },
      'additional',
      { builtinNames: ['Dracula'] }
    )
    expect(r.ok).toBe(false)
  })
})

describe('validateTheme — color rejections', () => {
  it('rejects named CSS colors', () => {
    const r = validateTheme(
      { ...validTheme, colors: { background: 'red' } },
      'additional',
      { builtinNames: [] }
    )
    expect(r.ok).toBe(false)
  })

  it('rejects unknown color keys (not in allowlist)', () => {
    const r = validateTheme(
      { ...validTheme, colors: { evilKey: '#000000' } },
      'additional',
      { builtinNames: [] }
    )
    expect(r.ok).toBe(false)
  })

  it('rejects __proto__ at the entry level', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- intentional any: testing prototype-pollution via raw JSON.parse
    const evil = JSON.parse(
      '{"__proto__":{"isAdmin":true},"name":"Evil","colors":{"background":"#000000"}}'
    )
    const r = validateTheme(evil, 'additional', { builtinNames: [] })
    expect(r.ok).toBe(false)
  })

  it('rejects constructor / prototype as own properties at entry level', () => {
    expect(
      validateTheme(
        { name: 'X', colors: {}, constructor: 'evil' },
        'additional',
        { builtinNames: [] }
      ).ok
    ).toBe(false)
  })
})

describe('validateTheme — license + source', () => {
  it('rejects license containing </script>', () => {
    expect(
      validateTheme(
        { ...validTheme, license: 'MIT </script>' },
        'additional',
        { builtinNames: [] }
      ).ok
    ).toBe(false)
  })

  it('rejects non-https source', () => {
    expect(
      validateTheme(
        { ...validTheme, source: 'http://example.com' },
        'additional',
        { builtinNames: [] }
      ).ok
    ).toBe(false)
    expect(
      validateTheme(
        { ...validTheme, source: 'javascript:alert(1)' },
        'additional',
        { builtinNames: [] }
      ).ok
    ).toBe(false)
  })
})

describe('validateTheme — size cap', () => {
  it('rejects > 4 KiB serialized JSON', () => {
    const big = { ...validTheme, license: 'A'.repeat(5000) }
    expect(validateTheme(big, 'additional', { builtinNames: [] }).ok).toBe(false)
  })
})
