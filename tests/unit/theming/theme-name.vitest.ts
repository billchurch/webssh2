import { describe, expect, it } from 'vitest'
import {
  canonicalizeThemeName,
  isReservedThemeName,
  THEME_NAME_REGEX
} from '../../../app/services/theming/theme-name.js'

describe('canonicalizeThemeName', () => {
  it('NFKC-normalizes, trims, collapses whitespace, and lowercases', () => {
    expect(canonicalizeThemeName('  Dracula  ')).toBe('dracula')
    expect(canonicalizeThemeName('Tokyo  Night')).toBe('tokyo night')
    expect(canonicalizeThemeName('Dracula')).toBe('dracula')
    expect(canonicalizeThemeName('DRACULA')).toBe('dracula')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(canonicalizeThemeName('   ')).toBe('')
  })
})

describe('isReservedThemeName', () => {
  it('treats "default" and "custom" as reserved (case + whitespace insensitive)', () => {
    expect(isReservedThemeName('Default')).toBe(true)
    expect(isReservedThemeName('  custom  ')).toBe(true)
    expect(isReservedThemeName('CUSTOM')).toBe(true)
    expect(isReservedThemeName('Dracula')).toBe(false)
  })
})

describe('THEME_NAME_REGEX', () => {
  it('accepts safe printable characters', () => {
    expect(THEME_NAME_REGEX.test('Dracula')).toBe(true)
    expect(THEME_NAME_REGEX.test('Solarized Dark')).toBe(true)
    expect(THEME_NAME_REGEX.test('Catppuccin Mocha (v2)')).toBe(true)
    expect(THEME_NAME_REGEX.test('one-dark')).toBe(true)
  })

  it('rejects HTML-injection bait and other unsafe characters', () => {
    expect(THEME_NAME_REGEX.test('</script>')).toBe(false)
    expect(THEME_NAME_REGEX.test('<img>')).toBe(false)
    expect(THEME_NAME_REGEX.test('a&b')).toBe(false)
    expect(THEME_NAME_REGEX.test('a"b')).toBe(false)
    expect(THEME_NAME_REGEX.test('')).toBe(false)
  })
})
