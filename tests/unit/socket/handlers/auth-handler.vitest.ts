// tests/unit/socket/handlers/auth-handler.test.ts
// Unit tests for pure auth handler functions
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { describe, it, expect } from 'vitest'
import {
  validateAuthCredentials,
  mergeWithServerDefaults,
  createAuthenticatedSessionState,
  handleAuthRequest,
  createAuthResponse,
  requiresInteractiveAuth,
  createInitialSessionState,
  type SessionState,
} from '../../../../app/socket/handlers/auth-handler.js'
import type { Config } from '../../../../app/types/config.js'
import {
  TEST_USERNAME,
  TEST_PASSWORDS,
  TEST_SSH,
  TEST_SERVER_DEFAULT_KEY,
  TEST_USER_KEY,
} from '@tests/test-constants.js'

describe('Auth Handler', () => {
  describe('validateAuthCredentials', () => {
    it('should validate valid credentials with password', () => {
      const result = validateAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORDS.secret123,
      })
      
      expect(result.valid).toBe(true)
      expect(result.data).toEqual({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        password: TEST_PASSWORDS.secret123,
      })
    })

    it('should validate valid credentials with private key', () => {
      const result = validateAuthCredentials({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: 2222,
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
        passphrase: TEST_SSH.PASSPHRASE,
      })
      
      expect(result.valid).toBe(true)
      expect(result.data).toEqual({
        username: TEST_USERNAME,
        host: TEST_SSH.HOST,
        port: 2222,
        privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----',
        passphrase: TEST_SSH.PASSPHRASE,
      })
    })

    it('should reject invalid credentials format', () => {
      const result = validateAuthCredentials(null)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid credentials format')
    })

    it('should reject missing username', () => {
      const result = validateAuthCredentials({
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Username is required and must be a non-empty string')
    })

    it('should reject missing host', () => {
      const result = validateAuthCredentials({
        username: TEST_USERNAME,
        port: 22,
        password: TEST_PASSWORDS.secret,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Host is required and must be a non-empty string')
    })

    it('should reject invalid port', () => {
      const result = validateAuthCredentials({
        username: TEST_USERNAME,
        host: 'example.com',
        port: 99999,
        password: TEST_PASSWORDS.secret,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Port must be a number between 1 and 65535')
    })

    it('should reject missing authentication method', () => {
      const result = validateAuthCredentials({
        username: TEST_USERNAME,
        host: 'example.com',
        port: 22,
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Either password or privateKey is required for authentication')
    })

    it('should handle string port conversion', () => {
      const result = validateAuthCredentials({
        username: TEST_USERNAME,
        host: 'example.com',
        port: '2222',
        password: TEST_PASSWORDS.secret,
      })
      
      expect(result.valid).toBe(true)
      expect(result.data?.port).toBe(2222)
    })

    it('should include optional terminal settings', () => {
      const result = validateAuthCredentials({
        username: TEST_USERNAME,
        host: 'example.com',
        port: 22,
        password: TEST_PASSWORDS.secret,
        term: 'xterm-256color',
        cols: 80,
        rows: 24,
      })
      
      expect(result.valid).toBe(true)
      expect(result.data).toMatchObject({
        term: 'xterm-256color',
        cols: 80,
        rows: 24,
      })
    })
  })

  describe('mergeWithServerDefaults', () => {
    const mockConfig: Config = {
      user: {
        privateKey: TEST_SERVER_DEFAULT_KEY,
      },
      ssh: {
        term: 'xterm-color',
        disableInteractiveAuth: false,
        port: 22,
        algorithms: {},
        keepaliveInterval: 60000,
        keepaliveCountMax: 10,
        readyTimeout: 20000,
      },
      options: {
        allowReauth: true,
        allowReplay: false,
        autoLog: false,
        allowReconnect: true,
      },
    } as Config

    it('should use server default private key when not provided', () => {
      const result = mergeWithServerDefaults(
        {
          username: TEST_USERNAME,
          host: 'example.com',
          port: 22,
          password: TEST_PASSWORDS.secret,
        },
        mockConfig
      )
      
      expect(result.privateKey).toBe('server-default-key')
    })

    it('should not override user-provided private key', () => {
      const result = mergeWithServerDefaults(
        {
          username: TEST_USERNAME,
          host: 'example.com',
          port: 22,
          privateKey: TEST_USER_KEY,
        },
        mockConfig
      )
      
      expect(result.privateKey).toBe('user-key')
    })

    it('should use server default terminal when not provided', () => {
      const result = mergeWithServerDefaults(
        {
          username: TEST_USERNAME,
          host: 'example.com',
          port: 22,
          password: TEST_PASSWORDS.secret,
        },
        mockConfig
      )
      
      expect(result.term).toBe('xterm-color')
    })

    it('should not override user-provided terminal', () => {
      const result = mergeWithServerDefaults(
        {
          username: TEST_USERNAME,
          host: 'example.com',
          port: 22,
          password: TEST_PASSWORDS.secret,
          term: 'vt100',
        },
        mockConfig
      )
      
      expect(result.term).toBe('vt100')
    })
  })

  describe('createAuthenticatedSessionState', () => {
    it('should create authenticated session state from credentials', () => {
      const currentState = createInitialSessionState()
      const result = createAuthenticatedSessionState(
        {
          username: TEST_USERNAME,
          host: 'example.com',
          port: 2222,
          password: TEST_PASSWORDS.secret,
          term: 'xterm',
          cols: 120,
          rows: 40,
        },
        currentState
      )
      
      expect(result).toEqual({
        authenticated: true,
        username: TEST_USERNAME,
        password: TEST_PASSWORDS.secret,
        privateKey: null,
        passphrase: null,
        host: 'example.com',
        port: 2222,
        term: 'xterm',
        cols: 120,
        rows: 40,
      })
    })

    it('should preserve existing terminal dimensions if not provided', () => {
      const currentState: SessionState = {
        ...createInitialSessionState(),
        cols: 80,
        rows: 24,
      }
      
      const result = createAuthenticatedSessionState(
        {
          username: TEST_USERNAME,
          host: 'example.com',
          port: 22,
          password: TEST_PASSWORDS.secret,
        },
        currentState
      )
      
      expect(result.cols).toBe(80)
      expect(result.rows).toBe(24)
    })
  })

  describe('handleAuthRequest', () => {
    const mockConfig = {
      user: { privateKey: '' },
      ssh: { term: 'xterm-color', disableInteractiveAuth: false },
    } as Config

    it('should successfully handle valid auth request', () => {
      const sessionState = createInitialSessionState()
      const result = handleAuthRequest(
        {
          username: TEST_USERNAME,
          host: 'example.com',
          port: 22,
          password: TEST_PASSWORDS.secret,
        },
        sessionState,
        mockConfig
      )
      
      expect(result.success).toBe(true)
      expect(result.sessionState?.authenticated).toBe(true)
      expect(result.credentials).toBeDefined()
    })

    it('should handle invalid credentials', () => {
      const sessionState = createInitialSessionState()
      const result = handleAuthRequest(
        { invalid: 'data' },
        sessionState,
        mockConfig
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.sessionState).toBeUndefined()
    })
  })

  describe('createAuthResponse', () => {
    it('should create success response', () => {
      const response = createAuthResponse({
        success: true,
        sessionState: createInitialSessionState(),
      })
      
      expect(response).toEqual({
        action: 'auth_result',
        success: true,
      })
    })

    it('should create failure response with error message', () => {
      const response = createAuthResponse({
        success: false,
        error: 'Invalid credentials',
      })
      
      expect(response).toEqual({
        action: 'auth_result',
        success: false,
        message: 'Invalid credentials',
      })
    })
  })

  describe('requiresInteractiveAuth', () => {
    const mockConfig = {
      ssh: { disableInteractiveAuth: false },
    } as Config

    it('should not require auth if already authenticated', () => {
      const sessionState: SessionState = {
        ...createInitialSessionState(),
        authenticated: true,
      }
      
      expect(requiresInteractiveAuth(sessionState, mockConfig)).toBe(false)
    })

    it('should not require auth if interactive auth is disabled', () => {
      const sessionState = createInitialSessionState()
      const config = {
        ...mockConfig,
        ssh: { ...mockConfig.ssh, disableInteractiveAuth: true },
      }
      
      expect(requiresInteractiveAuth(sessionState, config)).toBe(false)
    })

    it('should require auth if no credentials exist', () => {
      const sessionState = createInitialSessionState()
      
      expect(requiresInteractiveAuth(sessionState, mockConfig)).toBe(true)
    })

    it('should not require auth if credentials exist', () => {
      const sessionState: SessionState = {
        ...createInitialSessionState(),
        username: TEST_USERNAME,
        host: 'example.com',
        password: TEST_PASSWORDS.secret,
      }
      
      expect(requiresInteractiveAuth(sessionState, mockConfig)).toBe(false)
    })
  })

  describe('createInitialSessionState', () => {
    it('should create empty initial state', () => {
      const state = createInitialSessionState()
      
      expect(state).toEqual({
        authenticated: false,
        username: null,
        password: null,
        privateKey: null,
        passphrase: null,
        host: null,
        port: null,
        term: null,
        cols: null,
        rows: null,
      })
    })
  })
})