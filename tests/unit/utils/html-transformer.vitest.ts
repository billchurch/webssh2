// tests/unit/utils/html-transformer.test.ts
// Tests for pure HTML transformation functions

import { describe, it, expect } from 'vitest'
import {
  transformAssetPaths,
  injectConfig,
  transformHtml
} from '../../../app/utils/index.js'
import { injectConfigWithThemingString } from '../../../app/utils/html-transformer.js'

describe('transformAssetPaths', () => {
  it('should transform relative asset paths', () => {
    const html = '<link href="styles.css"><script src="app.js"></script>'
    const result = transformAssetPaths(html)
    
    expect(result).toBe('<link href="/ssh/assets/styles.css"><script src="/ssh/assets/app.js"></script>')
  })
  
  it('should not transform absolute URLs', () => {
    const html = '<link href="http://example.com/styles.css"><script src="//cdn.example.com/app.js"></script>'
    const result = transformAssetPaths(html)
    
    expect(result).toBe(html)
  })
  
  it('should handle mixed paths correctly', () => {
    const html = '<link href="local.css"><script src="http://example.com/remote.js"></script>'
    const result = transformAssetPaths(html)
    
    expect(result).toBe('<link href="/ssh/assets/local.css"><script src="http://example.com/remote.js"></script>')
  })
})

describe('injectConfig', () => {
  it('should inject configuration object', () => {
    const html = '<script>window.webssh2Config = null;</script>'
    const config = { test: 'value', nested: { key: 'data' } }
    
    const result = injectConfig(html, config)
    
    expect(result).toBe('<script>window.webssh2Config = {"test":"value","nested":{"key":"data"}};</script>')
  })
  
  it('should handle empty config', () => {
    const html = '<script>window.webssh2Config = null;</script>'
    const config = {}
    
    const result = injectConfig(html, config)
    
    expect(result).toBe('<script>window.webssh2Config = {};</script>')
  })
  
  it('should not modify HTML without config placeholder', () => {
    const html = '<script>console.log("test")</script>'
    const config = { test: 'value' }
    
    const result = injectConfig(html, config)
    
    expect(result).toBe(html)
  })
})

describe('transformHtml', () => {
  it('should apply both transformations', () => {
    const html = '<link href="styles.css"><script>window.webssh2Config = null;</script>'
    const config = { theme: 'dark' }

    const result = transformHtml(html, config)

    expect(result).toBe('<link href="/ssh/assets/styles.css"><script>window.webssh2Config = {"theme":"dark"};</script>')
  })

  it('should be pure - not mutate inputs', () => {
    const html = '<link href="styles.css">'
    const config = { test: 'value' }
    const originalHtml = html
    const originalConfig = { ...config }

    transformHtml(html, config)

    expect(html).toBe(originalHtml)
    expect(config).toEqual(originalConfig)
  })
})

describe('injectConfig — script-safe escaping', () => {
  const HOST = '<script>window.webssh2Config = null;</script>'

  it('escapes </script> in admin string fields', () => {
    const config = { name: '</script><script>alert(1)</script>' }
    const html = injectConfig(HOST, config)
    expect(html).not.toContain('</script><script>alert(1)')
    expect(html).toContain('\\u003c')
  })

  it('escapes </Script> case-insensitively', () => {
    const config = { name: '</Script>' }
    expect(injectConfig(HOST, config)).not.toContain('</Script>')
  })

  it('escapes <!-- HTML comment open', () => {
    const config = { x: '<!-- bait' }
    expect(injectConfig(HOST, config)).not.toContain('<!--')
  })

  it('escapes U+2028 and U+2029', () => {
    const config = { x: 'a\u2028b\u2029c' }
    const html = injectConfig(HOST, config)
    expect(html).not.toContain('\u2028')
    expect(html).not.toContain('\u2029')
    expect(html).toContain('\\u2028')
    expect(html).toContain('\\u2029')
  })
})

describe('injectConfigWithThemingString', () => {
  const HOST = '<script>window.webssh2Config = null;</script>'

  it('splices theming JSON into a non-empty config', () => {
    const html = injectConfigWithThemingString(
      HOST,
      { autoConnect: true },
      '{"enabled":false}'
    )
    expect(html).toBe(
      '<script>window.webssh2Config = {"autoConnect":true,"theming":{"enabled":false}};</script>'
    )
  })

  it('handles empty config without producing malformed JSON', () => {
    const html = injectConfigWithThemingString(HOST, {}, '{"enabled":false}')
    expect(html).toBe(
      '<script>window.webssh2Config = {"theming":{"enabled":false}};</script>'
    )
    expect(html).not.toContain('{,')
  })

  it('preserves the script-safe escaping of the base config', () => {
    const html = injectConfigWithThemingString(
      HOST,
      { msg: '</script>a\u2028b\u2029c' },
      '{"enabled":false}'
    )
    expect(html).not.toContain('</script>a')
    expect(html).not.toContain('\u2028')
    expect(html).not.toContain('\u2029')
    expect(html).toContain('\\u003c')
    expect(html).toContain('\\u2028')
    expect(html).toContain('\\u2029')
  })

  it('does not modify HTML without the placeholder', () => {
    const html = injectConfigWithThemingString(
      '<script>console.log("noop")</script>',
      { x: 1 },
      '{"enabled":false}'
    )
    expect(html).toBe('<script>console.log("noop")</script>')
  })
})
