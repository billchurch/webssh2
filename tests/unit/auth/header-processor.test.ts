// tests/unit/auth/header-processor.test.ts
// Tests for header processing functions

import { describe, it, expect } from 'vitest'
import {
  detectSourceType,
  validateHeaderValue,
  colorToStyle,
  extractHeaderValues,
  createHeaderOverride,
  mergeHeaderOverride,
  processHeaderParams,
  SourceType
} from '../../../app/auth/header-processor.js'

describe('detectSourceType', () => {
  it('should detect GET source', () => {
    expect(detectSourceType({ header: 'test' })).toBe(SourceType.GET)
    expect(detectSourceType({ headerBackground: 'red' })).toBe(SourceType.GET)
    expect(detectSourceType({ headerStyle: 'bold' })).toBe(SourceType.GET)
  })
  
  it('should detect POST source', () => {
    expect(detectSourceType({ 'header.name': 'test' })).toBe(SourceType.POST)
    expect(detectSourceType({ 'header.color': 'red' })).toBe(SourceType.POST)
    expect(detectSourceType({ 'header.background': 'blue' })).toBe(SourceType.POST)
  })
  
  it('should return NONE for undefined or empty', () => {
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

describe('colorToStyle', () => {
  it('should convert valid colors to style', () => {
    expect(colorToStyle('red')).toBe('color: red')
    expect(colorToStyle('#ff0000')).toBe('color: #ff0000')
    expect(colorToStyle('rgb(255, 0, 0)')).toBe('color: rgb(255, 0, 0)')
  })
  
  it('should return null for invalid values', () => {
    expect(colorToStyle(null)).toBe(null)
    expect(colorToStyle('')).toBe(null)
    expect(colorToStyle('javascript:alert(1)')).toBe(null)
    expect(colorToStyle('<script>')).toBe(null)
  })
})

describe('extractHeaderValues', () => {
  it('should extract GET parameters', () => {
    const source = {
      header: 'Title',
      headerBackground: 'blue',
      headerStyle: 'bold'
    }
    
    const result = extractHeaderValues(source, SourceType.GET)
    
    expect(result).toEqual({
      header: 'Title',
      background: 'blue',
      color: 'bold'
    })
  })
  
  it('should extract POST parameters', () => {
    const source = {
      'header.name': 'Title',
      'header.background': 'green',
      'header.color': 'white'
    }
    
    const result = extractHeaderValues(source, SourceType.POST)
    
    expect(result).toEqual({
      header: 'Title',
      background: 'green',
      color: 'white'
    })
  })
  
  it('should return empty for NONE type', () => {
    const result = extractHeaderValues({ some: 'data' }, SourceType.NONE)
    expect(result).toEqual({})
  })
})

describe('createHeaderOverride', () => {
  it('should create override from valid values', () => {
    const values = {
      header: 'My Title',
      background: 'blue',
      color: 'white'
    }
    
    const result = createHeaderOverride(values, SourceType.POST)
    
    expect(result).toEqual({
      text: 'My Title',
      background: 'blue',
      style: 'color: white'
    })
  })
  
  it('should handle GET source type for style', () => {
    const values = {
      header: 'Title',
      color: 'bold'
    }
    
    const result = createHeaderOverride(values, SourceType.GET)
    
    expect(result).toEqual({
      text: 'Title',
      style: 'bold'
    })
  })
  
  it('should return null for all invalid values', () => {
    const values = {
      header: '',
      background: null,
      color: undefined
    }
    
    const result = createHeaderOverride(values, SourceType.POST)
    
    expect(result).toBe(null)
  })
  
  it('should include only valid fields', () => {
    const values = {
      header: 'Title',
      background: '',
      color: null
    }
    
    const result = createHeaderOverride(values, SourceType.GET)
    
    expect(result).toEqual({
      text: 'Title'
    })
  })
})

describe('mergeHeaderOverride', () => {
  it('should merge overrides', () => {
    const existing = { text: 'Old', background: 'red' }
    const override = { background: 'blue', style: 'bold' }
    
    const result = mergeHeaderOverride(existing, override)
    
    expect(result).toEqual({
      text: 'Old',
      background: 'blue',
      style: 'bold'
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
  
  it('should process POST parameters', () => {
    const source = {
      'header.name': 'Dashboard',
      'header.color': '#333'
    }
    
    const result = processHeaderParams(source)
    
    expect(result).toEqual({
      text: 'Dashboard',
      style: 'color: #333'
    })
  })
})