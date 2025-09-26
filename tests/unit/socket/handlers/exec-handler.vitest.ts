// tests/unit/socket/handlers/exec-handler.test.ts
// Unit tests for pure exec handler functions

import { describe, it, expect } from 'vitest'
import {
  validateExecPayload,
  createExecState,
  createExecOptions,
  mergeEnvironmentVariables,
  handleExecRequest,
  createExecDataPayload,
  createExecExitPayload,
  isCommandSafe,
  sanitizeEnvVarName,
  filterEnvironmentVariables,
  type ExecState,
} from '../../../../app/socket/handlers/exec-handler.js'
import { DEFAULTS } from '../../../../app/constants.js'
import { TEST_PASSWORDS } from '../../../test-constants.js'

describe('Exec Handler', () => {
  describe('validateExecPayload', () => {
    it('should validate valid exec payload', () => {
      const result = validateExecPayload({
        command: 'ls -la',
        pty: true,
        term: 'xterm',
        cols: 80,
        rows: 24,
        env: { FOO: 'bar' },
        timeoutMs: 5000,
      })
      
      expect(result.valid).toBe(true)
      expect(result.data).toEqual({
        command: 'ls -la',
        pty: true,
        term: 'xterm',
        cols: 80,
        rows: 24,
        env: { FOO: 'bar' },
        timeoutMs: 5000,
      })
    })

    it('should validate minimal payload', () => {
      const result = validateExecPayload({
        command: 'pwd',
      })
      
      expect(result.valid).toBe(true)
      expect(result.data).toEqual({
        command: 'pwd',
      })
    })

    it('should reject invalid payload format', () => {
      const result = validateExecPayload(null)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid exec payload format')
    })

    it('should reject missing command', () => {
      const result = validateExecPayload({
        pty: true,
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Command is required')
    })

    it('should reject empty command', () => {
      const result = validateExecPayload({
        command: '  ',
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Command is required')
    })

    it('should reject invalid PTY flag', () => {
      const result = validateExecPayload({
        command: 'ls',
        pty: 'yes',
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('PTY flag must be boolean')
    })

    it('should reject invalid terminal type', () => {
      const result = validateExecPayload({
        command: 'ls',
        term: '',
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid terminal type')
    })

    it('should validate and convert string dimensions', () => {
      const result = validateExecPayload({
        command: 'ls',
        cols: '120',
        rows: '40',
      })
      
      expect(result.valid).toBe(true)
      expect(result.data?.cols).toBe(120)
      expect(result.data?.rows).toBe(40)
    })

    it('should reject invalid dimensions', () => {
      const result = validateExecPayload({
        command: 'ls',
        cols: 0,
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid columns value')
    })

    it('should reject dimensions over limit', () => {
      const result = validateExecPayload({
        command: 'ls',
        rows: 1001,
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid rows value')
    })

    it('should validate environment variables', () => {
      const result = validateExecPayload({
        command: 'env',
        env: {
          PATH: '/usr/bin',
          HOME: '/home/user',
        },
      })
      
      expect(result.valid).toBe(true)
      expect(result.data?.env).toEqual({
        PATH: '/usr/bin',
        HOME: '/home/user',
      })
    })

    it('should reject non-object env', () => {
      const result = validateExecPayload({
        command: 'env',
        env: ['FOO=bar'],
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Environment variables must be an object')
    })

    it('should reject non-string env values', () => {
      const result = validateExecPayload({
        command: 'env',
        env: { FOO: 123 },
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Environment variables must be string key-value pairs')
    })

    it('should validate timeout', () => {
      const result = validateExecPayload({
        command: 'sleep 1',
        timeoutMs: '10000',
      })
      
      expect(result.valid).toBe(true)
      expect(result.data?.timeoutMs).toBe(10000)
    })

    it('should reject invalid timeout', () => {
      const result = validateExecPayload({
        command: 'ls',
        timeoutMs: -1,
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid timeout value')
    })

    it('should reject timeout over limit', () => {
      const result = validateExecPayload({
        command: 'ls',
        timeoutMs: 3600001,
      })
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid timeout value')
    })
  })

  describe('createExecState', () => {
    it('should create exec state with all values', () => {
      const result = createExecState(
        {
          command: 'ls -la',
          pty: true,
          term: 'xterm',
          cols: 100,
          rows: 30,
          env: { FOO: 'bar' },
          timeoutMs: 5000,
        },
        'vt100',
        80,
        24
      )
      
      expect(result).toEqual({
        command: 'ls -la',
        pty: true,
        term: 'xterm',
        cols: 100,
        rows: 30,
        env: { FOO: 'bar' },
        timeoutMs: 5000,
      })
    })

    it('should use session defaults', () => {
      const result = createExecState(
        { command: 'pwd' },
        'xterm-256color',
        120,
        40
      )
      
      expect(result).toEqual({
        command: 'pwd',
        pty: false,
        term: 'xterm-256color',
        cols: 120,
        rows: 40,
        env: {},
        timeoutMs: undefined,
      })
    })

    it('should use system defaults', () => {
      const result = createExecState(
        { command: 'pwd' },
        null,
        null,
        null
      )
      
      expect(result).toEqual({
        command: 'pwd',
        pty: false,
        term: DEFAULTS.SSH_TERM,
        cols: DEFAULTS.TERM_COLS,
        rows: DEFAULTS.TERM_ROWS,
        env: {},
        timeoutMs: undefined,
      })
    })
  })

  describe('createExecOptions', () => {
    it('should create PTY options', () => {
      const state: ExecState = {
        command: 'ls',
        pty: true,
        term: 'xterm',
        cols: 80,
        rows: 24,
        env: {},
        timeoutMs: undefined,
      }
      
      const result = createExecOptions(state)
      
      expect(result).toEqual({
        pty: true,
        term: 'xterm',
        cols: 80,
        rows: 24,
      })
    })

    it('should create non-PTY options', () => {
      const state: ExecState = {
        command: 'ls',
        pty: false,
        term: 'xterm',
        cols: 80,
        rows: 24,
        env: {},
        timeoutMs: undefined,
      }
      
      const result = createExecOptions(state)
      
      expect(result).toEqual({})
    })
  })

  describe('mergeEnvironmentVariables', () => {
    it('should merge multiple sources', () => {
      const result = mergeEnvironmentVariables(
        { FOO: 'bar' },
        { BAR: 'baz' },
        { QUX: 'quux' }
      )
      
      expect(result).toEqual({
        FOO: 'bar',
        BAR: 'baz',
        QUX: 'quux',
      })
    })

    it('should override earlier values', () => {
      const result = mergeEnvironmentVariables(
        { FOO: 'bar' },
        { FOO: 'baz' }
      )
      
      expect(result).toEqual({
        FOO: 'baz',
      })
    })

    it('should handle null/undefined sources', () => {
      const result = mergeEnvironmentVariables(
        null,
        undefined,
        { FOO: 'bar' },
        null
      )
      
      expect(result).toEqual({
        FOO: 'bar',
      })
    })

    it('should return empty object for all null sources', () => {
      const result = mergeEnvironmentVariables(null, undefined)
      
      expect(result).toEqual({})
    })
  })

  describe('handleExecRequest', () => {
    it('should handle valid exec request', () => {
      const result = handleExecRequest(
        {
          command: 'ls -la',
          pty: true,
        },
        'xterm',
        80,
        24,
        { PATH: '/usr/bin' }
      )
      
      expect(result.success).toBe(true)
      expect(result.state?.command).toBe('ls -la')
      expect(result.options?.pty).toBe(true)
      expect(result.env?.PATH).toBe('/usr/bin')
    })

    it('should handle invalid request', () => {
      const result = handleExecRequest(
        null,
        'xterm',
        80,
        24
      )
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('createExecDataPayload', () => {
    it('should create stdout payload', () => {
      const result = createExecDataPayload('stdout', 'output text')
      
      expect(result).toEqual({
        type: 'stdout',
        data: 'output text',
      })
    })

    it('should create stderr payload', () => {
      const result = createExecDataPayload('stderr', 'error text')
      
      expect(result).toEqual({
        type: 'stderr',
        data: 'error text',
      })
    })
  })

  describe('createExecExitPayload', () => {
    it('should create exit payload with code', () => {
      const result = createExecExitPayload(0, null)
      
      expect(result).toEqual({
        code: 0,
        signal: null,
      })
    })

    it('should create exit payload with signal', () => {
      const result = createExecExitPayload(null, 'SIGTERM')
      
      expect(result).toEqual({
        code: null,
        signal: 'SIGTERM',
      })
    })

    it('should handle both code and signal', () => {
      const result = createExecExitPayload(143, 'SIGTERM')
      
      expect(result).toEqual({
        code: 143,
        signal: 'SIGTERM',
      })
    })
  })

  describe('isCommandSafe', () => {
    it('should allow safe commands', () => {
      expect(isCommandSafe('ls -la')).toBe(true)
      expect(isCommandSafe('pwd')).toBe(true)
      expect(isCommandSafe('echo "hello"')).toBe(true)
    })

    it('should detect dangerous rm commands', () => {
      expect(isCommandSafe('ls; rm -rf /')).toBe(false)
      expect(isCommandSafe('echo test; rm -rf /home')).toBe(false)
    })

    it('should detect dangerous dd commands', () => {
      expect(isCommandSafe('dd if=/dev/zero of=/dev/sda')).toBe(false)
    })

    it('should detect redirects to block devices', () => {
      expect(isCommandSafe('echo test > /dev/sda')).toBe(false)
    })
  })

  describe('sanitizeEnvVarName', () => {
    it('should allow valid names', () => {
      expect(sanitizeEnvVarName('FOO_BAR')).toBe('FOO_BAR')
      expect(sanitizeEnvVarName('PATH')).toBe('PATH')
      expect(sanitizeEnvVarName('HOME123')).toBe('HOME123')
    })

    it('should remove invalid characters', () => {
      expect(sanitizeEnvVarName('FOO-BAR')).toBe('FOOBAR')
      expect(sanitizeEnvVarName('FOO.BAR')).toBe('FOOBAR')
      expect(sanitizeEnvVarName('FOO BAR')).toBe('FOOBAR')
    })

    it('should reject names starting with numbers', () => {
      expect(sanitizeEnvVarName('123FOO')).toBeNull()
    })

    it('should reject empty names', () => {
      expect(sanitizeEnvVarName('')).toBeNull()
      expect(sanitizeEnvVarName('---')).toBeNull()
    })

    it('should reject too long names', () => {
      const longName = 'A'.repeat(256)
      expect(sanitizeEnvVarName(longName)).toBeNull()
    })
  })

  describe('filterEnvironmentVariables', () => {
    it('should filter sensitive variables', () => {
      const result = filterEnvironmentVariables({
        PATH: '/usr/bin',
        SSH_AUTH_SOCK: '/tmp/ssh-agent', //NOSONAR
        AWS_SECRET_ACCESS_KEY: TEST_PASSWORDS.secret,
        HOME: '/home/user',
      })
      
      expect(result).toEqual({
        PATH: '/usr/bin',
        HOME: '/home/user',
      })
      expect(result.SSH_AUTH_SOCK).toBeUndefined()
      expect(result.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    })

    it('should sanitize keys', () => {
      const result = filterEnvironmentVariables({
        'FOO-BAR': 'value',
        'VALID_NAME': 'value2',
      })
      
      expect(result).toEqual({
        FOOBAR: 'value',
        VALID_NAME: 'value2',
      })
    })

    it('should limit value length', () => {
      const longValue = 'A'.repeat(20000)
      const result = filterEnvironmentVariables({
        FOO: longValue,
      })
      
      expect(result.FOO).toHaveLength(10000)
    })

    it('should skip invalid keys', () => {
      const result = filterEnvironmentVariables({
        '123INVALID': 'value',
        '': 'value',
        VALID: 'value',
      })
      
      expect(result).toEqual({
        VALID: 'value',
      })
    })
  })
})