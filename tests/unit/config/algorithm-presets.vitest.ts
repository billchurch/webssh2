// tests/unit/config/algorithm-presets.vitest.ts
// Unit tests for algorithm preset lookup (issue #561: prototype-member names)

import { describe, it, expect } from 'vitest'
import { ALGORITHM_PRESETS, getAlgorithmPreset } from '../../../app/config/algorithm-presets.js'

describe('getAlgorithmPreset', () => {
  it.each(['modern', 'legacy', 'strict'])('returns the %s preset', (name) => {
    // eslint-disable-next-line security/detect-object-injection -- test data uses known preset names only
    expect(getAlgorithmPreset(name)).toEqual(ALGORITHM_PRESETS[name])
  })

  it('is case-insensitive', () => {
    expect(getAlgorithmPreset('MODERN')).toEqual(ALGORITHM_PRESETS['modern'])
  })

  it('returns undefined for unknown preset names', () => {
    expect(getAlgorithmPreset('banana')).toBeUndefined()
  })

  it.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__'])(
    'returns undefined for prototype-member name %s',
    (name) => {
      expect(getAlgorithmPreset(name)).toBeUndefined()
    }
  )
})
