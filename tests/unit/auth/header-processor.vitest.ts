// tests/unit/auth/header-processor.test.ts
// Tests for header processing functions

import { describe, it, expect } from 'vitest'
import {
  detectSourceType,
  validateHeaderValue,
  extractHeaderValues,
  createHeaderOverride,
  mergeHeaderOverride,
  processHeaderParams,
  hasAnyHeaderKey,
  SourceType
} from '../../../app/auth/header-processor.js'

describe('detectSourceType', () => {
  it('detects GET parameters', () => {
    expect(detectSourceType({ header: 'test' })).toBe(SourceType.GET)
    expect(detectSourceType({ headerBackground: 'red' })).toBe(SourceType.GET)
  })

  it('detects POST parameters', () => {
    expect(detectSourceType({ 'header.name': 'test' })).toBe(SourceType.POST)
    expect(detectSourceType({ 'header.background': 'blue' })).toBe(SourceType.POST)
  })

  it('returns NONE for legacy-only sources (issue #102)', () => {
    // headerStyle and header.color are silently ignored. They do NOT
    // cause source-type classification, so processHeaderParams returns
    // null for legacy-only requests. The clear-vs-preserve behavior is
    // handled in auth-utils.ts via hasAnyHeaderKey.
    expect(detectSourceType({ headerStyle: 'bold' })).toBe(SourceType.NONE)
    expect(detectSourceType({ 'header.color': 'red' })).toBe(SourceType.NONE)
  })

  it('returns NONE for empty or unrelated sources', () => {
    expect(detectSourceType(undefined)).toBe(SourceType.NONE)
    expect(detectSourceType({})).toBe(SourceType.NONE)
    expect(detectSourceType({ other: 'value' })).toBe(SourceType.NONE)
  })
})

describe('validateHeaderValue', () => {
  it('should validate valid strings', () => {
    expect(validateHeaderValue('Test Header')).toBe('Test Header')
    expect(validateHeaderValue('background-color')).toBe('background-color')
  })
  
  it('should return null for invalid values', () => {
    expect(validateHeaderValue(null)).toBe(null)
    expect(validateHeaderValue(undefined)).toBe(null)
    expect(validateHeaderValue('')).toBe(null)
    expect(validateHeaderValue(123)).toBe(null)
    expect(validateHeaderValue({})).toBe(null)
  })
  
  it('should remove control characters', () => {
    expect(validateHeaderValue('test\x00value')).toBe('testvalue')
    expect(validateHeaderValue('line1\nline2')).toBe('line1line2')
  })
  
  it('should limit length to 100 characters', () => {
    const longString = 'a'.repeat(150)
    const result = validateHeaderValue(longString)
    expect(result).toHaveLength(100)
  })
})

describe('extractHeaderValues', () => {
  it('should extract GET parameters (header + background only)', () => {
    const source = {
      header: 'Title',
      headerBackground: 'blue',
      headerStyle: 'bold' // ignored
    }

    const result = extractHeaderValues(source, SourceType.GET)

    expect(result).toEqual({
      header: 'Title',
      background: 'blue'
    })
  })

  it('should extract POST parameters (header.name + header.background only)', () => {
    const source = {
      'header.name': 'Title',
      'header.background': 'green',
      'header.color': 'white' // ignored
    }

    const result = extractHeaderValues(source, SourceType.POST)

    expect(result).toEqual({
      header: 'Title',
      background: 'green'
    })
  })

  it('should return empty for NONE type', () => {
    const result = extractHeaderValues({ some: 'data' }, SourceType.NONE)
    expect(result).toEqual({})
  })
})

describe('createHeaderOverride', () => {
  it('should create override with text + background', () => {
    const values = {
      header: 'My Title',
      background: 'blue'
    }

    const result = createHeaderOverride(values, SourceType.POST)

    expect(result).toEqual({
      text: 'My Title',
      background: 'blue'
    })
  })

  it('should return null when both text and background are invalid', () => {
    const values = {
      header: '',
      background: null
    }

    const result = createHeaderOverride(values, SourceType.POST)

    expect(result).toBe(null)
  })

  it('should include only valid fields', () => {
    const values = {
      header: 'Title',
      background: ''
    }

    const result = createHeaderOverride(values, SourceType.GET)

    expect(result).toEqual({
      text: 'Title'
    })
  })

  it('should never produce a style field (issue #102)', () => {
    const result = createHeaderOverride(
      { header: 'X', background: 'red' },
      SourceType.POST
    )
    expect(result).not.toHaveProperty('style')
  })
})

describe('mergeHeaderOverride', () => {
  it('should merge overrides', () => {
    const existing = { text: 'Old', background: 'red' }
    const override = { background: 'blue' }

    const result = mergeHeaderOverride(existing, override)

    expect(result).toEqual({
      text: 'Old',
      background: 'blue'
    })
  })

  it('should handle undefined existing', () => {
    const override = { text: 'New' }

    const result = mergeHeaderOverride(undefined, override)

    expect(result).toEqual({ text: 'New' })
  })

  it('should be pure - not mutate inputs', () => {
    const existing = { text: 'Original' }
    const override = { background: 'green' }
    const originalExisting = { ...existing }

    mergeHeaderOverride(existing, override)

    expect(existing).toEqual(originalExisting)
  })
})

describe('processHeaderParams', () => {
  it('should process GET parameters', () => {
    const source = {
      header: 'Test Title',
      headerBackground: 'navy'
    }
    
    const result = processHeaderParams(source)
    
    expect(result).toEqual({
      text: 'Test Title',
      background: 'navy'
    })
  })
  
  it('should return null for no valid params', () => {
    expect(processHeaderParams(undefined)).toBe(null)
    expect(processHeaderParams({})).toBe(null)
    expect(processHeaderParams({ other: 'value' })).toBe(null)
  })
  
  it('should process POST parameters (no color extraction)', () => {
    const source = {
      'header.name': 'Dashboard',
      'header.background': '#333'
    }

    const result = processHeaderParams(source)

    expect(result).toEqual({
      text: 'Dashboard',
      background: '#333'
    })
  })

  it('returns null for legacy-only sources', () => {
    expect(processHeaderParams({ headerStyle: 'bold' })).toBe(null)
    expect(processHeaderParams({ 'header.color': 'red' })).toBe(null)
    expect(
      processHeaderParams({ headerStyle: 'bold', 'header.color': 'red' })
    ).toBe(null)
  })
})

describe('hasAnyHeaderKey', () => {
  it('returns false for undefined source', () => {
    expect(hasAnyHeaderKey(undefined)).toBe(false)
  })

  it('returns false for empty source', () => {
    expect(hasAnyHeaderKey({})).toBe(false)
  })

  it('returns false for unrelated keys', () => {
    expect(hasAnyHeaderKey({ port: '22', username: 'x' })).toBe(false)
  })

  it.each([
    ['header'],
    ['headerBackground'],
    ['header.name'],
    ['header.background']
  ])('returns true for current key: %s', (key) => {
    expect(hasAnyHeaderKey({ [key]: 'x' })).toBe(true)
  })

  it.each([
    ['headerStyle'],
    ['header.color']
  ])('returns true for legacy key: %s', (key) => {
    expect(hasAnyHeaderKey({ [key]: 'x' })).toBe(true)
  })
})