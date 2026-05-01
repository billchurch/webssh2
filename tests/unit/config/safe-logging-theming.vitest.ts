import { describe, expect, it } from 'vitest'
import { maskSensitiveConfig } from '../../../app/config/safe-logging.js'

describe('maskSensitiveConfig with theming', () => {
  it('masks color values and license/source from output', () => {
    const config = {
      options: {
        theming: {
          enabled: true,
          allowCustom: true,
          themes: ['Default', 'Dracula'],
          additionalThemes: [
            {
              name: 'leaky',
              colors: { background: '#deadbe' },
              license: 'SUPER-SECRET'
            }
          ],
          defaultTheme: 'Default',
          headerBackground: 'independent'
        }
      }
    } as unknown as Parameters<typeof maskSensitiveConfig>[0]

    const masked = maskSensitiveConfig(config)
    const blob = JSON.stringify(masked)
    expect(blob).not.toContain('#deadbe')
    expect(blob).not.toContain('SUPER-SECRET')
    expect(masked.theming?.themesCount).toBe(2)
    expect(masked.theming?.additionalThemesCount).toBe(1)
    expect(masked.theming?.enabled).toBe(true)
  })

  it('omits theming block when undefined', () => {
    const config = { options: {} } as unknown as Parameters<
      typeof maskSensitiveConfig
    >[0]
    const masked = maskSensitiveConfig(config)
    expect(masked.theming).toBeUndefined()
  })
})
