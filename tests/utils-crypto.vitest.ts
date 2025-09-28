import { describe, it, expect } from 'vitest'
import { generateSecureSecret } from '../app/utils/crypto.js'

describe('utils/crypto.ts', () => {
  it('generates a 64-char hex secret', () => {
    const s = generateSecureSecret()
    expect(s).toMatch(/^[0-9a-f]{64}$/)
  })
})
