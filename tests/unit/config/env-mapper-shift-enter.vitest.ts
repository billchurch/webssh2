// tests/unit/config/env-mapper-shift-enter.vitest.ts

import { describe, it, expect } from 'vitest'
import { mapEnvironmentVariables } from '../../../app/config/env-mapper.js'

type OptionsOut = { terminal?: { shiftEnterNewline?: boolean } } | undefined

describe('env-mapper WEBSSH2_TERMINAL_SHIFT_ENTER_NEWLINE', () => {
  it('maps "true" to options.terminal.shiftEnterNewline', () => {
    const out = mapEnvironmentVariables({
      WEBSSH2_TERMINAL_SHIFT_ENTER_NEWLINE: 'true'
    })
    const options = out['options'] as OptionsOut
    expect(options?.terminal?.shiftEnterNewline).toBe(true)
  })

  it('maps "false" explicitly', () => {
    const out = mapEnvironmentVariables({
      WEBSSH2_TERMINAL_SHIFT_ENTER_NEWLINE: 'false'
    })
    const options = out['options'] as OptionsOut
    expect(options?.terminal?.shiftEnterNewline).toBe(false)
  })

  it('is absent when the env var is not set', () => {
    const out = mapEnvironmentVariables({})
    const options = out['options'] as OptionsOut
    expect(options?.terminal).toBeUndefined()
  })
})
