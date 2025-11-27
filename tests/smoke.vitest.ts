import { describe, it, expect } from 'vitest'
import { deepMerge } from '../app/utils/index.js'
import { validateSshTerm } from '../app/validation/index.js'
import { MESSAGES, DEFAULTS } from '../app/constants/index.js'

describe('smoke', () => {
  it('deepMerge merges nested objects', () => {
    const a = { x: 1, y: { z: 2 } }
    const b = { y: { w: 3 } }
    const c = deepMerge(a, b)
    expect(c).toEqual({ x: 1, y: { z: 2, w: 3 } })
  })

  it('validateSshTerm returns valid terms', () => {
    expect(validateSshTerm('xterm-256color')).toBe('xterm-256color')
    expect(validateSshTerm('bad term')).toBeNull()
  })

  it('constants are present', () => {
    expect(MESSAGES.UNEXPECTED_ERROR).toBeTypeOf('string')
    expect(DEFAULTS.SSH_PORT).toBe(22)
  })
})
