// tests/unit/utils/html-transformer.test.ts
// Tests for pure HTML transformation functions

import { describe, it, expect } from 'vitest'
import { 
  transformAssetPaths,
  injectConfig,
  transformHtml
} from '../../../app/utils/html-transformer.js'

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