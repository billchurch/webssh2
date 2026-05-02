import { describe, expect, it } from 'vitest'
import {
  buildClientThemingPayload,
  serializeThemingForInjection
} from '../../../app/services/theming/theming-injection.js'

describe('buildClientThemingPayload', () => {
  it('returns { enabled: false } only when disabled', () => {
    const payload = buildClientThemingPayload({
      enabled: false,
      allowCustom: true,
      themes: null,
      additionalThemes: [],
      defaultTheme: 'Default',
      headerBackground: 'independent'
    })
    expect(payload).toEqual({ enabled: false })
  })

  it('returns full payload when enabled', () => {
    const payload = buildClientThemingPayload({
      enabled: true,
      allowCustom: false,
      themes: ['Default', 'Dracula'],
      additionalThemes: [
        { name: 'Corp', colors: { background: '#101010' } }
      ],
      defaultTheme: 'Default',
      headerBackground: 'followTerminal'
    })
    expect(payload).toMatchObject({
      enabled: true,
      allowCustom: false,
      themes: ['Default', 'Dracula'],
      additionalThemes: [{ name: 'Corp' }],
      defaultTheme: 'Default',
      headerBackground: 'followTerminal'
    })
  })

  it('preserves optional license/source fields when present', () => {
    const payload = buildClientThemingPayload({
      enabled: true,
      allowCustom: true,
      themes: null,
      additionalThemes: [
        {
          name: 'Corp',
          colors: { background: '#101010' },
          license: 'MIT',
          source: 'https://example.com/theme'
        }
      ],
      defaultTheme: 'Default',
      headerBackground: 'independent'
    })
    if (payload.enabled === false) {
      throw new Error('expected enabled payload')
    }
    expect(payload.additionalThemes[0]).toMatchObject({
      name: 'Corp',
      license: 'MIT',
      source: 'https://example.com/theme'
    })
  })
})

describe('serializeThemingForInjection', () => {
  it('returns script-safe JSON', () => {
    const json = serializeThemingForInjection({
      enabled: true,
      allowCustom: true,
      themes: null,
      additionalThemes: [
        { name: 'Evil', colors: { background: '#000000' }, license: 'a</b' }
      ],
      defaultTheme: 'Default',
      headerBackground: 'independent'
    })
    expect(json).not.toContain('<')
    expect(json).toContain('\\u003c')
  })

  it('escapes U+2028 and U+2029 line terminators', () => {
    const json = serializeThemingForInjection({
      enabled: true,
      allowCustom: true,
      themes: null,
      additionalThemes: [
        {
          name: 'Sep',
          colors: { background: '#000000' },
          source: 'a\u2028b\u2029c'
        }
      ],
      defaultTheme: 'Default',
      headerBackground: 'independent'
    })
    expect(json).not.toContain('\u2028')
    expect(json).not.toContain('\u2029')
    expect(json).toContain('\\u2028')
    expect(json).toContain('\\u2029')
  })
})
