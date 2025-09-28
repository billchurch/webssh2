// tests/unit/types/result.test.ts

import { describe, it, expect } from 'vitest'
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  andThen,
  orElse,
  unwrap,
  unwrapOr,
  unwrapOrElse,
  toNullable,
  fromNullable,
  tryCatch,
  combine,
  combineAll
} from '../../../app/utils/result.js'
import type { Result } from '../../../app/types/result.js'

void describe('Result type', () => {
  describe('ok and err constructors', () => {
    it('creates success result', () => {
      const result = ok(42)
      expect(result).toEqual({ ok: true, value: 42 })
    })
    
    it('creates error result', () => {
      const result = err('error')
      expect(result).toEqual({ ok: false, error: 'error' })
    })
  })
  
  describe('isOk and isErr', () => {
    it('identifies success result', () => {
      const result = ok(42)
      expect(isOk(result)).toBe(true)
      expect(isErr(result)).toBe(false)
    })
    
    it('identifies error result', () => {
      const result = err('error')
      expect(isOk(result)).toBe(false)
      expect(isErr(result)).toBe(true)
    })
  })
  
  describe('map', () => {
    it('transforms success value', () => {
      const result = ok(5)
      const mapped = map(result, x => x * 2)
      expect(mapped).toEqual(ok(10))
    })
    
    it('passes through error', () => {
      const result = err<string>('error')
      const mapped = map(result, (x: number) => x * 2)
      expect(mapped).toEqual(err('error'))
    })
  })
  
  describe('mapErr', () => {
    it('transforms error value', () => {
      const result = err('error')
      const mapped = mapErr(result, e => `Error: ${e}`)
      expect(mapped).toEqual(err('Error: error'))
    })
    
    it('passes through success', () => {
      const result = ok(42)
      const mapped = mapErr(result, (e: string) => `Error: ${e}`)
      expect(mapped).toEqual(ok(42))
    })
  })
  
  describe('andThen', () => {
    it('chains successful operations', () => {
      const result = ok(5)
      const chained = andThen(result, x => ok(x * 2))
      expect(chained).toEqual(ok(10))
    })
    
    it('short-circuits on first error', () => {
      const result = err<string>('first error')
      const chained = andThen(result, (x: number) => ok(x * 2))
      expect(chained).toEqual(err('first error'))
    })
    
    it('propagates error from chained operation', () => {
      const result = ok(5)
      const chained = andThen(result, () => err('chained error'))
      expect(chained).toEqual(err('chained error'))
    })
  })
  
  describe('orElse', () => {
    it('provides alternative on error', () => {
      const result = err('error')
      const alternative = orElse(result, () => ok(42))
      expect(alternative).toEqual(ok(42))
    })
    
    it('passes through success', () => {
      const result = ok(42)
      const alternative = orElse(result, () => ok(99))
      expect(alternative).toEqual(ok(42))
    })
  })
  
  describe('unwrap', () => {
    it('returns value on success', () => {
      const result = ok(42)
      expect(unwrap(result)).toBe(42)
    })
    
    it('throws on error', () => {
      const result = err('error')
      expect(() => unwrap(result)).toThrow()
    })
  })
  
  describe('unwrapOr', () => {
    it('returns value on success', () => {
      const result = ok(42)
      expect(unwrapOr(result, 99)).toBe(42)
    })
    
    it('returns default on error', () => {
      const result = err('error')
      expect(unwrapOr(result, 99)).toBe(99)
    })
  })
  
  describe('unwrapOrElse', () => {
    it('returns value on success', () => {
      const result = ok(42)
      expect(unwrapOrElse(result, () => 99)).toBe(42)
    })
    
    it('computes default on error', () => {
      const result = err('error')
      expect(unwrapOrElse(result, e => e.length)).toBe(5)
    })
  })
  
  describe('toNullable', () => {
    it('returns value on success', () => {
      const result = ok(42)
      expect(toNullable(result)).toBe(42)
    })
    
    it('returns null on error', () => {
      const result = err('error')
      expect(toNullable(result)).toBe(null)
    })
  })
  
  describe('fromNullable', () => {
    it('creates success from non-null value', () => {
      const result = fromNullable(42, 'was null')
      expect(result).toEqual(ok(42))
    })
    
    it('creates error from null', () => {
      const result = fromNullable(null, 'was null')
      expect(result).toEqual(err('was null'))
    })
    
    it('creates error from undefined', () => {
      const result = fromNullable(undefined, 'was undefined')
      expect(result).toEqual(err('was undefined'))
    })
  })
  
  describe('tryCatch', () => {
    it('returns success for non-throwing function', () => {
      const result = tryCatch(() => 42)
      expect(result).toEqual(ok(42))
    })
    
    it('returns error for throwing function', () => {
      const result = tryCatch(() => {
        throw new Error('boom')
      })
      expect(isErr(result)).toBe(true)
      if (isErr(result)) {
        expect(result.error.message).toBe('boom')
      }
    })
    
    it('maps error with custom mapper', () => {
      const result = tryCatch(
        () => {
          throw new Error('boom')
        },
        (e: unknown) => `Caught: ${(e as Error).message}`
      )
      expect(result).toEqual(err('Caught: boom'))
    })
  })
  
  describe('combine', () => {
    it('combines all success results', () => {
      const results = [ok(1), ok(2), ok(3)]
      const combined = combine(results)
      expect(combined).toEqual(ok([1, 2, 3]))
    })
    
    it('returns first error', () => {
      const results: Array<Result<number, string>> = [
        ok(1),
        err('first error'),
        err('second error')
      ]
      const combined = combine(results)
      expect(combined).toEqual(err('first error'))
    })
  })
  
  describe('combineAll', () => {
    it('combines all success results', () => {
      const results = [ok(1), ok(2), ok(3)]
      const combined = combineAll(results)
      expect(combined).toEqual(ok([1, 2, 3]))
    })
    
    it('collects all errors', () => {
      const results: Array<Result<number, string>> = [
        ok(1),
        err('error1'),
        ok(2),
        err('error2')
      ]
      const combined = combineAll(results)
      expect(combined).toEqual(err(['error1', 'error2']))
    })
  })
})