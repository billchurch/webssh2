import { describe, expect, it, vi } from 'vitest'
import { mapEnvironmentVariables } from '../../../app/config/env-mapper.js'

describe('env-mapper theming', () => {
  it('maps WEBSSH2_THEMING_ENABLED', () => {
    const out = mapEnvironmentVariables({ WEBSSH2_THEMING_ENABLED: 'true' })
    const options = out['options'] as { theming?: { enabled?: boolean } } | undefined
    expect(options?.theming?.enabled).toBe(true)
  })

  it('drops malformed names from WEBSSH2_THEMING_THEMES (CSV)', () => {
    const out = mapEnvironmentVariables({
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_THEMES: 'Default,</script>,Dracula'
    })
    const options = out['options'] as { theming?: { themes?: string[] } } | undefined
    expect(options?.theming?.themes).toEqual(['Default', 'Dracula'])
  })

  it('falls back to "Default" for malformed defaultTheme', () => {
    const out = mapEnvironmentVariables({
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_DEFAULT_THEME: '<bad>'
    })
    const options = out['options'] as { theming?: { defaultTheme?: string } } | undefined
    expect(options?.theming?.defaultTheme).toBe('Default')
  })

  it('parses base64 additionalThemes', () => {
    const json = JSON.stringify([
      { name: 'Corp', colors: { background: '#101010' } }
    ])
    const b64 = Buffer.from(json, 'utf8').toString('base64')
    const out = mapEnvironmentVariables({
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_ADDITIONAL_THEMES: b64
    })
    const options = out['options'] as {
      theming?: { additionalThemes?: Array<{ name: string }> }
    } | undefined
    expect(options?.theming?.additionalThemes?.[0]?.name).toBe('Corp')
  })

  it('returns empty additionalThemes on garbage env (no throw)', () => {
    const out = mapEnvironmentVariables({
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_ADDITIONAL_THEMES: 'GARBAGE!!!'
    })
    const options = out['options'] as {
      theming?: { additionalThemes?: unknown[] }
    } | undefined
    expect(options?.theming?.additionalThemes).toEqual([])
  })

  it('accepts valid WEBSSH2_THEMING_HEADER_BACKGROUND values', () => {
    const out = mapEnvironmentVariables({
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_HEADER_BACKGROUND: 'followTerminal'
    })
    const options = out['options'] as {
      theming?: { headerBackground?: string }
    } | undefined
    expect(options?.theming?.headerBackground).toBe('followTerminal')
  })

  it('leaves headerBackground unset on invalid WEBSSH2_THEMING_HEADER_BACKGROUND', () => {
    const out = mapEnvironmentVariables({
      WEBSSH2_THEMING_ENABLED: 'true',
      WEBSSH2_THEMING_HEADER_BACKGROUND: 'rainbow'
    })
    const options = out['options'] as {
      theming?: { headerBackground?: string }
    } | undefined
    expect(options?.theming?.headerBackground).toBeUndefined()
  })

  it('emits onThemingWarning hook for invalid additionalThemes entries', () => {
    const json = JSON.stringify([
      { name: 'Default', colors: { background: '#101010' } }, // collides with builtin
      { name: 'Corp', colors: { background: '#101010' } }
    ])
    const b64 = Buffer.from(json, 'utf8').toString('base64')
    const onThemingWarning = vi.fn()
    mapEnvironmentVariables(
      {
        WEBSSH2_THEMING_ENABLED: 'true',
        WEBSSH2_THEMING_ADDITIONAL_THEMES: b64
      },
      { onThemingWarning }
    )
    expect(onThemingWarning).toHaveBeenCalled()
    const calls = onThemingWarning.mock.calls as Array<
      [{ source: string; path: string; reason: string }]
    >
    const warnings = calls.map((args) => args[0])
    expect(warnings.some((w) => w.source === 'WEBSSH2_THEMING_ADDITIONAL_THEMES')).toBe(true)
    expect(warnings.some((w) => /collid|builtin|reserved/i.test(w.reason))).toBe(true)
  })

  it('emits onThemingWarning hook when base64 decode fails', () => {
    const onThemingWarning = vi.fn()
    mapEnvironmentVariables(
      {
        WEBSSH2_THEMING_ENABLED: 'true',
        WEBSSH2_THEMING_ADDITIONAL_THEMES: 'GARBAGE!!!'
      },
      { onThemingWarning }
    )
    expect(onThemingWarning).toHaveBeenCalledTimes(1)
    const warning = onThemingWarning.mock.calls[0]?.[0] as {
      source: string
      reason: string
    }
    expect(warning.source).toBe('WEBSSH2_THEMING_ADDITIONAL_THEMES')
    expect(warning.reason).toMatch(/base64|json|notArray|oversize/i)
  })

  it('does not invoke hooks when additionalThemes is absent', () => {
    const onThemingWarning = vi.fn()
    mapEnvironmentVariables(
      { WEBSSH2_THEMING_ENABLED: 'true' },
      { onThemingWarning }
    )
    expect(onThemingWarning).not.toHaveBeenCalled()
  })
})
