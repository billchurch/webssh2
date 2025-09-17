// tests/unit/config-enhanced.test.ts
// Test enhanced config feature parity

import { describe, it, expect } from 'vitest'
import {
  validateSshHost,
  validateSshPort,
  validateCssColor,
  validateFilePath,
} from '../../app/validation/config.js'
import { ConfigBuilder } from '../../app/utils/config-builder.js'
// Note: loadEnhancedConfig is now internal to config.ts
// We'll test through the public API instead
import { mapEnvironmentVariables, ENV_VAR_MAPPING } from '../../app/config/env-mapper.js'
import type { Config } from '../../app/types/config.js'
import {
  TEST_USERNAME,
  TEST_PASSWORD,
  TEST_SECRET,
  TEST_SECRET_123,
  TEST_IPS,
  TEST_SUBNETS,
  SSO_AUTH_HEADERS
} from '../test-constants.js'

describe('Enhanced Config Feature Parity', () => {
  describe('Environment Variable Support', () => {
    it('should support all environment variables from ENV_VAR_MAPPING', () => {
      // Create a test environment with all supported variables
      const testEnv: Record<string, string> = {
        PORT: '3000',
        WEBSSH2_LISTEN_IP: TEST_IPS.LOCALHOST,
        WEBSSH2_LISTEN_PORT: '2222',
        WEBSSH2_HTTP_ORIGINS: 'http://localhost:3000,http://localhost:8080',
        WEBSSH2_SSH_HOST: 'example.com',
        WEBSSH2_SSH_PORT: '22',
        WEBSSH2_SSH_LOCAL_ADDRESS: TEST_IPS.PRIVATE_192,
        WEBSSH2_SSH_LOCAL_PORT: '2223',
        WEBSSH2_SSH_TERM: 'xterm-256color',
        WEBSSH2_SSH_ENV_ALLOWLIST: 'LANG,LC_ALL',
        WEBSSH2_SSH_ALLOWED_SUBNETS: `${TEST_SUBNETS.PRIVATE_192},${TEST_SUBNETS.PRIVATE_10}`,
        WEBSSH2_HEADER_TEXT: 'Test Header',
        WEBSSH2_HEADER_BACKGROUND: 'blue',
        WEBSSH2_OPTIONS_CHALLENGE_BUTTON: 'true',
        WEBSSH2_OPTIONS_AUTO_LOG: 'true',
        WEBSSH2_SSO_ENABLED: 'true',
        WEBSSH2_SSO_CSRF_PROTECTION: 'true',
        WEBSSH2_SSO_TRUSTED_PROXIES: `${TEST_IPS.LOCALHOST},${TEST_IPS.PRIVATE_192}`,
        WEBSSH2_SSO_HEADER_USERNAME: SSO_AUTH_HEADERS.username,
        WEBSSH2_SSO_HEADER_PASSWORD: SSO_AUTH_HEADERS.password,
        WEBSSH2_SSO_HEADER_SESSION: SSO_AUTH_HEADERS.session,
      }
      
      const config = mapEnvironmentVariables(testEnv)
      
      // Verify all mapped values are present
      expect(config.listen).toEqual({ ip: TEST_IPS.LOCALHOST, port: 2222 })
      expect(config.ssh).toMatchObject({
        host: 'example.com',
        port: 22,
        localAddress: TEST_IPS.PRIVATE_192,
        localPort: 2223,
        term: 'xterm-256color',
        envAllowlist: ['LANG', 'LC_ALL'],
        allowedSubnets: [TEST_SUBNETS.PRIVATE_192, TEST_SUBNETS.PRIVATE_10],
      })
      expect(config.header).toEqual({
        text: 'Test Header',
        background: 'blue',
      })
      expect(config.options).toMatchObject({
        challengeButton: true,
        autoLog: true,
      })
      expect(config.sso).toMatchObject({
        enabled: true,
        csrfProtection: true,
        trustedProxies: [TEST_IPS.LOCALHOST, TEST_IPS.PRIVATE_192],
        headerMapping: {
          username: SSO_AUTH_HEADERS.username,
          password: SSO_AUTH_HEADERS.password,
          session: SSO_AUTH_HEADERS.session,
        },
      })
    })
    
    it('should have mapping for all core environment variables', () => {
      const envVarCount = Object.keys(ENV_VAR_MAPPING).length
      // Current implementation has 42 environment variables mapped
      expect(envVarCount).toBeGreaterThanOrEqual(42)
    })
  })
  
  describe('SSH Configuration Fields', () => {
    it('should support localAddress and localPort fields', () => {
      const builder = new ConfigBuilder()
      builder
        .withSessionSecret(TEST_SECRET) // Required for validation
        .withSshHost('example.com')
        .withSshPort(22)
        .withSshLocalAddress(TEST_IPS.PRIVATE_192)
        .withSshLocalPort(2223)
      
      const result = builder.validate()
      if (!result.ok) {
        console.error('Validation failed:', result.error)
      }
      
      const config = builder.build()
      
      expect(config).toBeDefined()
      expect(config?.ssh).toMatchObject({
        host: 'example.com',
        port: 22,
        localAddress: TEST_IPS.PRIVATE_192,
        localPort: 2223,
      })
    })
    
    it('should support allowedSubnets field', () => {
      const builder = new ConfigBuilder()
      const config = builder
        .withSessionSecret(TEST_SECRET) // Required for validation
        .withSshAllowedSubnets([TEST_SUBNETS.PRIVATE_192, TEST_SUBNETS.PRIVATE_10])
        .build()
      
      expect(config?.ssh.allowedSubnets).toEqual([TEST_SUBNETS.PRIVATE_192, TEST_SUBNETS.PRIVATE_10])
    })
    
    it('should support SSH algorithms configuration', () => {
      const builder = new ConfigBuilder()
      builder
        .withSessionSecret(TEST_SECRET) // Required for validation
        .withSshAlgorithms({
          cipher: ['aes256-gcm'],
          kex: ['curve25519-sha256'],
          hmac: ['hmac-sha2-256'],
        })
      
      const result = builder.validate()
      if (!result.ok) {
        console.error('Algorithm test validation failed:', result.error)
      }
      const config = builder.build()
      
      expect(config).toBeDefined()
      expect(config?.ssh.algorithms).toMatchObject({
        cipher: ['aes256-gcm'],
        kex: ['curve25519-sha256'],
        hmac: ['hmac-sha2-256'],
      })
    })
  })
  
  describe('ConfigBuilder Completeness', () => {
    it('should support all configuration sections', () => {
      const builder = new ConfigBuilder()
      builder
        .withSessionSecret(TEST_SECRET_123) // Add session secret first for validation
        .withListenConfig(TEST_IPS.LOCALHOST, 3000)
        .withHttpOrigins(['http://localhost:3000'])
        .withUserCredentials({
          name: TEST_USERNAME,
          password: TEST_PASSWORD,
        })
        .withSshHost('ssh.example.com')
        .withSshPort(22)
        .withHeader('Test Header', 'blue')
        .withOptions({
          challengeButton: true,
          autoLog: true,
          allowReauth: false,
        })
        .withSessionName('test-session')
        .withSsoConfig({
          enabled: true,
          csrfProtection: true,
        })
      
      const result = builder.validate()
      if (!result.ok) {
        console.error('Complete config validation failed:', JSON.stringify(result.error, null, 2))
      }
      
      const config = builder.build()
      
      expect(config).toBeDefined()
      expect(config?.listen).toEqual({ ip: TEST_IPS.LOCALHOST, port: 3000 })
      expect(config?.http.origins).toEqual(['http://localhost:3000'])
      expect(config?.user).toMatchObject({
        name: TEST_USERNAME,
        password: TEST_PASSWORD,
      })
      expect(config?.ssh.host).toBe('ssh.example.com')
      expect(config?.header).toEqual({
        text: 'Test Header',
        background: 'blue',
      })
      expect(config?.options).toMatchObject({
        challengeButton: true,
        autoLog: true,
        allowReauth: false,
      })
      expect(config?.session).toMatchObject({
        secret: TEST_SECRET_123,
        name: 'test-session',
      })
      expect(config?.sso).toMatchObject({
        enabled: true,
        csrfProtection: true,
      })
    })
  })
  
  describe('CORS Configuration', () => {
    it('should generate CORS config from enhanced config', async () => {
      const builder = new ConfigBuilder()
      const config = builder
        .withSessionSecret(TEST_SECRET) // Required for validation
        .withHttpOrigins(['http://localhost:3000', 'http://localhost:8080'])
        .build()
      
      if (config) {
        // Import createCorsConfig from config-processor
        const { createCorsConfig } = await import('../../app/config/config-processor.js')
        const corsConfig = createCorsConfig(config)
        expect(corsConfig).toEqual({
          origin: ['http://localhost:3000', 'http://localhost:8080'],
          methods: ['GET', 'POST'],
          credentials: true,
        })
      }
    })
  })
  
  describe('Validation Functions', () => {
    describe('validateSshHost', () => {
      it('should validate SSH hosts correctly', () => {
        expect(validateSshHost('example.com')).toBe('example.com')
        expect(validateSshHost(TEST_IPS.PRIVATE_192)).toBe(TEST_IPS.PRIVATE_192)
        expect(validateSshHost(null)).toBe(null)
        expect(validateSshHost(undefined)).toBe(null)
        expect(validateSshHost('')).toBe(null)
        expect(() => validateSshHost('invalid host')).toThrow('contains spaces')
      })
    })
    
    describe('validateSshPort', () => {
      it('should validate SSH ports correctly', () => {
        expect(validateSshPort(22)).toBe(22)
        expect(validateSshPort(2222)).toBe(2222)
        expect(validateSshPort(undefined)).toBe(22) // default
        expect(() => validateSshPort(0)).toThrow('Invalid SSH port')
        expect(() => validateSshPort(65536)).toThrow('Invalid SSH port')
        expect(() => validateSshPort(3.14)).toThrow('Invalid SSH port')
      })
    })
    
    describe('validateCssColor', () => {
      it('should validate CSS colors', () => {
        expect(validateCssColor('red')).toBe('red')
        expect(validateCssColor('#ff0000')).toBe('#ff0000')
        expect(validateCssColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)')
        expect(validateCssColor(undefined)).toBeUndefined()
        expect(validateCssColor('')).toBeUndefined()
      })
    })
    
    describe('validateFilePath', () => {
      it('should validate file paths', () => {
        expect(validateFilePath('/path/to/file')).toBe('/path/to/file')
        expect(validateFilePath('./relative/path')).toBe('./relative/path')
        expect(validateFilePath(undefined)).toBeUndefined()
        expect(validateFilePath('')).toBeUndefined()
      })
    })
  })
  
  describe('Integration with Existing Systems', () => {
    it('should use existing validation pipeline', async () => {
      // This test verifies that enhanced config integrates with the existing validation
      // Import the public API from config.ts
      const { getConfig } = await import('../../app/config.js')
      const config = await getConfig()
      
      // Should have all required config fields
      expect(config).toHaveProperty('listen')
      expect(config).toHaveProperty('http')
      expect(config).toHaveProperty('user')
      expect(config).toHaveProperty('ssh')
      expect(config).toHaveProperty('header')
      expect(config).toHaveProperty('options')
      expect(config).toHaveProperty('session')
      expect(config).toHaveProperty('sso')
    })
  })
})