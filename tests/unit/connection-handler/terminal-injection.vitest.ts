// tests/unit/connection-handler/terminal-injection.vitest.ts
// buildTempConfig terminal slice (billchurch/webssh2#497)

import { describe, it, expect } from 'vitest'
import { buildTempConfig } from '../../../app/connectionHandler.js'
import type { Config } from '../../../app/types/config.js'
import { makeReq, defaultConfig } from './injection-test-helpers.js'

function cfgWithShiftEnter(enabled: boolean): Config {
  return {
    ...defaultConfig,
    options: {
      ...defaultConfig.options,
      terminal: { shiftEnterNewline: enabled }
    }
  }
}

describe('buildTempConfig - terminal slice', () => {
  it('injects terminal.shiftEnterNewline when enabled', () => {
    const tempConfig = buildTempConfig(makeReq(), cfgWithShiftEnter(true))
    expect(tempConfig['terminal']).toEqual({ shiftEnterNewline: true })
  })

  it('omits the terminal key entirely when disabled', () => {
    const tempConfig = buildTempConfig(makeReq(), cfgWithShiftEnter(false))
    expect('terminal' in tempConfig).toBe(false)
  })

  it('omits the terminal key when options.terminal is absent', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention, sonarjs/no-unused-vars -- intentional discard destructure
    const { terminal: _terminal, ...optionsWithout } = defaultConfig.options
    const cfg = { ...defaultConfig, options: optionsWithout }
    const tempConfig = buildTempConfig(makeReq(), cfg)
    expect('terminal' in tempConfig).toBe(false)
  })
})
