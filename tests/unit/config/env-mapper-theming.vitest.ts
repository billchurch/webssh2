import { describe, expect, it } from 'vitest'
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
})
