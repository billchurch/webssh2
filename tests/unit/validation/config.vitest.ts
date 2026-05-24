import { describe, it, expect } from 'vitest'
import { validateCssColor } from '../../../app/validation/config.js'

describe('validateCssColor', () => {
  it('returns undefined for null input', () => {
    expect(validateCssColor(null)).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(validateCssColor(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(validateCssColor('')).toBeUndefined()
  })

  it('accepts named colors', () => {
    expect(validateCssColor('green')).toBe('green')
  })

  it('accepts hex colors', () => {
    expect(validateCssColor('#ff00aa')).toBe('#ff00aa')
  })

  it('accepts short hex colors', () => {
    expect(validateCssColor('#000')).toBe('#000')
  })

  it('accepts rgb() function notation', () => {
    expect(validateCssColor('rgb(0, 0, 0)')).toBe('rgb(0, 0, 0)')
  })

  it('rejects javascript: scheme', () => {
    expect(validateCssColor('javascript:alert(1)')).toBeUndefined()
  })

  it('rejects CSS injection attempts', () => {
    expect(validateCssColor('red; } body{display:none} /*')).toBeUndefined()
  })

  it('rejects values with semicolons', () => {
    expect(validateCssColor('red; color:white')).toBeUndefined()
  })

  it('rejects values with curly braces', () => {
    expect(validateCssColor('red}')).toBeUndefined()
  })
})
