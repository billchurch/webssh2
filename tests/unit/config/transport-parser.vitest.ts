import { describe, expect, it } from 'vitest'
import { parseTransports } from '../../../app/config/transport-parser.js'

describe('parseTransports', () => {
  it('returns undefined transports and no warning when unset', () => {
    expect(parseTransports(undefined)).toEqual({
      transports: undefined,
      warning: undefined
    })
    expect(parseTransports(null)).toEqual({
      transports: undefined,
      warning: undefined
    })
  })

  it('parses the comma-separated string form', () => {
    expect(parseTransports('polling').transports).toEqual(['polling'])
    expect(parseTransports('polling,websocket').transports).toEqual([
      'polling',
      'websocket'
    ])
  })

  it('parses the array form', () => {
    expect(parseTransports(['websocket', 'polling']).transports).toEqual([
      'websocket',
      'polling'
    ])
  })

  it('trims and lowercases entries', () => {
    expect(parseTransports(' Polling , WEBSOCKET ').transports).toEqual([
      'polling',
      'websocket'
    ])
  })

  it('preserves order and dedupes', () => {
    expect(
      parseTransports('polling,websocket,polling').transports
    ).toEqual(['polling', 'websocket'])
  })

  it('filters invalid entries but keeps valid ones, warning-free', () => {
    const result = parseTransports('polling,carrier-pigeon')
    expect(result.transports).toEqual(['polling'])
    expect(result.warning).toBeUndefined()
  })

  it('warns and returns undefined when everything filters out', () => {
    const result = parseTransports('smtp,gopher')
    expect(result.transports).toBeUndefined()
    expect(result.warning).toMatch(/no valid transports/i)
  })

  it('warns and returns undefined for empty string and empty array', () => {
    expect(parseTransports('').transports).toBeUndefined()
    expect(parseTransports('').warning).toBeDefined()
    expect(parseTransports([]).transports).toBeUndefined()
    expect(parseTransports([]).warning).toBeDefined()
  })

  it('warns and returns undefined for non-string/array types', () => {
    const result = parseTransports(42)
    expect(result.transports).toBeUndefined()
    expect(result.warning).toMatch(/expected string or array/i)
  })

  it('drops non-string entries inside an array', () => {
    expect(parseTransports(['polling', 7, {}]).transports).toEqual(['polling'])
  })

  it('never returns an empty array', () => {
    for (const input of ['', [], 'bogus', ['bogus'], 0, {}, true]) {
      const { transports } = parseTransports(input)
      expect(transports === undefined || transports.length > 0).toBe(true)
    }
  })
})
