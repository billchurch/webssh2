// tests/unit/utils/data-masker.test.ts  
// Tests for pure data masking functions

import { describe, it, expect } from 'vitest'
import {
  createMaskingOptions,
  maskSensitive,
  DEFAULT_MASK_PROPERTIES
} from '../../../app/utils/data-masker.js'
import { TEST_PASSWORDS } from '../../test-constants.js'

describe('createMaskingOptions', () => {
  it('should return default properties when no options provided', () => {
    const options = createMaskingOptions()
    
    expect(options.properties).toEqual(DEFAULT_MASK_PROPERTIES)
  })
  
  it('should merge custom options with defaults', () => {
    const customOptions = {
      properties: ['customField'],
      customSetting: true
    }
    
    const options = createMaskingOptions(customOptions)
    
    expect(options).toEqual({
      properties: ['customField'],
      customSetting: true
    })
  })
  
  it('should preserve other custom settings', () => {
    const customOptions = {
      depth: 5,
      replacer: '***'
    }
    
    const options = createMaskingOptions(customOptions)
    
    expect(options).toEqual({
      properties: DEFAULT_MASK_PROPERTIES,
      depth: 5,
      replacer: '***'
    })
  })
})

describe('maskSensitive', () => {
  it('should mask default sensitive properties', () => {
    const data = {
      username: 'user123',
      password: TEST_PASSWORDS.secret123,
      privateKey: 'ssh-rsa-key',
      normalField: 'visible'
    }
    
    const masked = maskSensitive(data) as Record<string, unknown>
    
    expect(masked['username']).toBe('user123')
    expect(masked['password']).not.toBe(TEST_PASSWORDS.secret123)
    expect(masked['privateKey']).not.toBe('ssh-rsa-key')
    expect(masked['normalField']).toBe('visible')
  })
  
  it('should mask nested sensitive properties', () => {
    const data = {
      config: {
        user: 'admin',
        password: TEST_PASSWORDS.adminPass,
        settings: {
          token: 'jwt-token',
          theme: 'dark'
        }
      }
    }
    
    const masked = maskSensitive(data) as Record<string, unknown>
    const config = masked['config'] as Record<string, unknown>
    const settings = config['settings'] as Record<string, unknown>
    
    expect(config['user']).toBe('admin')
    expect(config['password']).not.toBe(TEST_PASSWORDS.adminPass)
    expect(settings['token']).not.toBe('jwt-token')
    expect(settings['theme']).toBe('dark')
  })
  
  it('should use custom masking properties', () => {
    const data = {
      apiKey: 'key123',
      password: TEST_PASSWORDS.basic123,
      customSecret: TEST_PASSWORDS.secret123
    }
    
    const masked = maskSensitive(data, {
      properties: ['customSecret']
    }) as Record<string, unknown>
    
    expect(masked['apiKey']).toBe('key123')
    expect(masked['password']).toBe(TEST_PASSWORDS.basic123) // Not in custom list
    expect(masked['customSecret']).not.toBe(TEST_PASSWORDS.secret123)
  })
  
  it('should be pure - not mutate input data', () => {
    const data = {
      username: 'user',
      password: TEST_PASSWORDS.secret
    }
    const originalData = { ...data }
    
    maskSensitive(data)
    
    expect(data).toEqual(originalData)
  })
})