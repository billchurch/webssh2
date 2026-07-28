// tests/unit/config/options-terminal-shift-enter.vitest.ts
// options.terminal.shiftEnterNewline (billchurch/webssh2#497)

import { describe, it, expect } from 'vitest'
import { validateConfigSchema } from '../../../app/utils/schema-validator.js'
import { createDefaultConfig } from '../../../app/config/config-processor.js'
import { TEST_SECRET_123 } from '../../test-constants.js'

describe('options.terminal.shiftEnterNewline', () => {
  it('defaults to false', () => {
    const cfg = createDefaultConfig(TEST_SECRET_123)
    expect(cfg.options.terminal?.shiftEnterNewline).toBe(false)
  })

  it('passes schema validation when enabled', () => {
    const cfg = createDefaultConfig(TEST_SECRET_123)
    const enabled = {
      ...cfg,
      options: { ...cfg.options, terminal: { shiftEnterNewline: true } }
    }
    const result = validateConfigSchema(enabled)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.options.terminal?.shiftEnterNewline).toBe(true)
    }
  })

  it('rejects a non-boolean value', () => {
    const cfg = createDefaultConfig(TEST_SECRET_123)
    const bad = {
      ...cfg,
      options: { ...cfg.options, terminal: { shiftEnterNewline: 'yes' } }
    }
    const result = validateConfigSchema(bad as never)
    expect(result.ok).toBe(false)
  })

  it('stays valid when the terminal block is absent (older config.json)', () => {
    const cfg = createDefaultConfig(TEST_SECRET_123)
    // eslint-disable-next-line @typescript-eslint/naming-convention, sonarjs/no-unused-vars -- intentional discard destructure
    const { terminal: _terminal, ...optionsWithout } = cfg.options
    const result = validateConfigSchema({ ...cfg, options: optionsWithout })
    expect(result.ok).toBe(true)
  })
})
