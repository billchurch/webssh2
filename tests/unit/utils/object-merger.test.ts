// tests/unit/utils/object-merger.test.ts
// Tests for pure object merging functions

import { describe, it, expect } from 'vitest'
import { isPlainObject, deepMergePure } from '../../../app/utils/object-merger.js'

describe('isPlainObject', () => {
  it('should return true for plain objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject({ nested: { value: true } })).toBe(true)
  })
  
  it('should return false for non-objects', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject(42)).toBe(false)
    expect(isPlainObject('string')).toBe(false)
    expect(isPlainObject(true)).toBe(false)
  })
  
  it('should return false for arrays', () => {
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject([1, 2, 3])).toBe(false)
  })
})

describe('deepMergePure', () => {
  it('should merge flat objects', () => {
    const target = { a: 1, b: 2 }
    const source = { b: 3, c: 4 }
    
    const result = deepMergePure(target, source)
    
    expect(result).toEqual({ a: 1, b: 3, c: 4 })
  })
  
  it('should deeply merge nested objects', () => {
    const target = {
      a: 1,
      nested: {
        x: 10,
        y: 20
      }
    }
    const source = {
      nested: {
        y: 30,
        z: 40
      },
      b: 2
    }
    
    const result = deepMergePure(target, source)
    
    expect(result).toEqual({
      a: 1,
      nested: {
        x: 10,
        y: 30,
        z: 40
      },
      b: 2
    })
  })
  
  it('should not mutate the original objects', () => {
    const target = { a: 1, nested: { x: 10 } }
    const source = { nested: { y: 20 } }
    const originalTarget = JSON.parse(JSON.stringify(target))
    const originalSource = JSON.parse(JSON.stringify(source))
    
    const result = deepMergePure(target, source)
    
    expect(target).toEqual(originalTarget)
    expect(source).toEqual(originalSource)
    expect(result).not.toBe(target)
  })
  
  it('should overwrite arrays, not merge them', () => {
    const target = { arr: [1, 2, 3] }
    const source = { arr: [4, 5] }
    
    const result = deepMergePure(target, source)
    
    expect(result).toEqual({ arr: [4, 5] })
  })
  
  it('should handle null and undefined source', () => {
    const target = { a: 1 }
    
    expect(deepMergePure(target, null)).toEqual({ a: 1 })
    expect(deepMergePure(target, undefined)).toEqual({ a: 1 })
  })
  
  it('should handle non-object source types', () => {
    const target = { a: 1 }
    
    expect(deepMergePure(target, 42)).toEqual({ a: 1 })
    expect(deepMergePure(target, 'string')).toEqual({ a: 1 })
    expect(deepMergePure(target, true)).toEqual({ a: 1 })
  })
})