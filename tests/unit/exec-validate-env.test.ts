import { describe, it, expect } from 'vitest'
import { validateExecPayload } from '../../app/validators/exec-validate'

describe('validateExecPayload env handling', () => {
  it('accepts env as object with valid keys/values', () => {
    const out = validateExecPayload({ command: 'echo', env: { FOO: 'bar', BAR: 1 } })
    expect(out.env).toEqual({ FOO: 'bar', BAR: '1' })
  })

  it('filters invalid keys and values', () => {
    const out = validateExecPayload({ command: 'echo', env: { 'bad-key': '1', OK: '2', DROP: 'x;rm' } })
    expect(out.env).toEqual({ OK: '2' })
  })

  it('converts env array to numeric-key object', () => {
    const out = validateExecPayload({ command: 'echo', env: ['a', 'b'] })
    expect(out.env).toEqual({ '0': 'a', '1': 'b' })
  })
})

