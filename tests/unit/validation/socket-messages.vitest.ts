// tests/unit/validation/socket-messages.test.ts
// Unit tests for socket message validation

import { describe, it, expect } from 'vitest'
import {
  validateAuthMessage,
  validateTerminalMessage,
  validateResizeMessage,
  validateExecMessage,
  validateControlMessage
} from '../../../app/validation/socket-messages.js'
import { TEST_SSH, CONTROL_ACTIONS } from '../../test-constants.js'

describe('Socket Message Validation', () => {
  describe('validateAuthMessage', () => {
    it('should validate complete credentials with all fields', () => {
      const result = validateAuthMessage({
        username: TEST_SSH.USERNAME,
        password: TEST_SSH.PASSWORD,
        host: TEST_SSH.HOST,
        port: TEST_SSH.PORT,
        privateKey: TEST_SSH.PRIVATE_KEY,
        passphrase: TEST_SSH.PASSPHRASE,
        term: TEST_SSH.TERMINAL.TYPE,
        cols: TEST_SSH.TERMINAL.DEFAULT_COLS,
        rows: TEST_SSH.TERMINAL.DEFAULT_ROWS
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.username).toBe(TEST_SSH.USERNAME)
        expect(result.value.password).toBe(TEST_SSH.PASSWORD)
        expect(result.value.host).toBe(TEST_SSH.HOST)
        expect(result.value.port).toBe(TEST_SSH.PORT)
        expect(result.value.privateKey).toBe(TEST_SSH.PRIVATE_KEY)
        expect(result.value.passphrase).toBe(TEST_SSH.PASSPHRASE)
        expect(result.value.term).toBe(TEST_SSH.TERMINAL.TYPE)
        expect(result.value.cols).toBe(TEST_SSH.TERMINAL.DEFAULT_COLS)
        expect(result.value.rows).toBe(TEST_SSH.TERMINAL.DEFAULT_ROWS)
      }
    })

    it('should validate minimal required credentials', () => {
      const result = validateAuthMessage({
        username: TEST_SSH.USERNAME,
        host: TEST_SSH.HOST
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.username).toBe(TEST_SSH.USERNAME)
        expect(result.value.host).toBe(TEST_SSH.HOST)
        expect(result.value.port).toBe(TEST_SSH.PORT) // default port
        expect(result.value.password).toBeUndefined()
        expect(result.value.privateKey).toBeUndefined()
      }
    })

    it('should trim whitespace from string fields', () => {
      const result = validateAuthMessage({
        username: `  ${TEST_SSH.USERNAME}  `,
        host: `  ${TEST_SSH.HOST}  `
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.username).toBe(TEST_SSH.USERNAME)
        expect(result.value.host).toBe(TEST_SSH.HOST)
      }
    })

    it('should reject null or undefined data', () => {
      const resultNull = validateAuthMessage(null)
      const resultUndefined = validateAuthMessage(undefined)

      expect(resultNull.ok).toBe(false)
      expect(resultUndefined.ok).toBe(false)
      if (!resultNull.ok) {
        expect(resultNull.error.message).toContain('must be an object')
      }
    })

    it('should reject non-object data', () => {
      const result = validateAuthMessage('invalid')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('must be an object')
      }
    })

    it('should reject missing username', () => {
      const result = validateAuthMessage({
        host: TEST_SSH.HOST
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Username is required')
      }
    })

    it('should reject empty username', () => {
      const result = validateAuthMessage({
        username: '   ',
        host: TEST_SSH.HOST
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Username is required')
      }
    })

    it('should reject missing host', () => {
      const result = validateAuthMessage({
        username: TEST_SSH.USERNAME
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Host is required')
      }
    })

    it('should reject invalid port', () => {
      const result = validateAuthMessage({
        username: TEST_SSH.USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.INVALID_VALUES.STRING_PORT
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid port')
      }
    })

    it('should reject port out of range', () => {
      const resultNegative = validateAuthMessage({
        username: TEST_SSH.USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.INVALID_VALUES.PORT_NEGATIVE
      })

      const resultTooHigh = validateAuthMessage({
        username: TEST_SSH.USERNAME,
        host: TEST_SSH.HOST,
        port: TEST_SSH.INVALID_VALUES.PORT_TOO_HIGH
      })

      expect(resultNegative.ok).toBe(false)
      expect(resultTooHigh.ok).toBe(false)
    })

    it('should reject invalid cols value', () => {
      const result = validateAuthMessage({
        username: TEST_SSH.USERNAME,
        host: TEST_SSH.HOST,
        cols: TEST_SSH.INVALID_VALUES.COLS_TOO_HIGH // too high
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Columns must be an integer between 1 and 9999')
      }
    })

    it('should reject invalid rows value', () => {
      const result = validateAuthMessage({
        username: TEST_SSH.USERNAME,
        host: TEST_SSH.HOST,
        rows: TEST_SSH.INVALID_VALUES.ROWS_TOO_LOW // too low
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Rows must be an integer between 1 and 9999')
      }
    })
  })

  describe('validateTerminalMessage', () => {
    it('should validate complete terminal config', () => {
      const result = validateTerminalMessage({
        term: TEST_SSH.TERMINAL.TYPE,
        rows: TEST_SSH.TERMINAL.MEDIUM_ROWS,
        cols: TEST_SSH.TERMINAL.MEDIUM_COLS
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.term).toBe(TEST_SSH.TERMINAL.TYPE)
        expect(result.value.rows).toBe(TEST_SSH.TERMINAL.MEDIUM_ROWS)
        expect(result.value.cols).toBe(TEST_SSH.TERMINAL.MEDIUM_COLS)
      }
    })

    it('should use defaults when fields are missing', () => {
      const result = validateTerminalMessage({})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rows).toBe(TEST_SSH.TERMINAL.DEFAULT_ROWS)
        expect(result.value.cols).toBe(TEST_SSH.TERMINAL.DEFAULT_COLS)
        expect(result.value.term).toBeUndefined()
      }
    })

    it('should validate string representation of numbers', () => {
      const result = validateTerminalMessage({
        rows: String(TEST_SSH.TERMINAL.MEDIUM_ROWS),
        cols: String(TEST_SSH.TERMINAL.MEDIUM_COLS)
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rows).toBe(TEST_SSH.TERMINAL.MEDIUM_ROWS)
        expect(result.value.cols).toBe(TEST_SSH.TERMINAL.MEDIUM_COLS)
      }
    })

    it('should reject invalid rows', () => {
      const result = validateTerminalMessage({
        rows: 'invalid'
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Rows must be an integer')
      }
    })

    it('should reject invalid cols', () => {
      const result = validateTerminalMessage({
        cols: -5
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Columns must be an integer')
      }
    })

    it('should reject non-string term', () => {
      const result = validateTerminalMessage({
        term: { invalid: 'object' }
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Terminal type must be a string')
      }
    })
  })

  describe('validateResizeMessage', () => {
    it('should validate valid resize params', () => {
      const result = validateResizeMessage({
        rows: TEST_SSH.TERMINAL.LARGE_ROWS,
        cols: TEST_SSH.TERMINAL.LARGE_COLS
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rows).toBe(TEST_SSH.TERMINAL.LARGE_ROWS)
        expect(result.value.cols).toBe(TEST_SSH.TERMINAL.LARGE_COLS)
      }
    })

    it('should validate string representation of numbers', () => {
      const result = validateResizeMessage({
        rows: String(TEST_SSH.TERMINAL.LARGE_ROWS),
        cols: String(TEST_SSH.TERMINAL.LARGE_COLS)
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rows).toBe(TEST_SSH.TERMINAL.LARGE_ROWS)
        expect(result.value.cols).toBe(TEST_SSH.TERMINAL.LARGE_COLS)
      }
    })

    it('should reject missing rows', () => {
      const result = validateResizeMessage({
        cols: TEST_SSH.TERMINAL.MEDIUM_COLS
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Both rows and cols are required')
      }
    })

    it('should reject missing cols', () => {
      const result = validateResizeMessage({
        rows: TEST_SSH.TERMINAL.MEDIUM_ROWS
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Both rows and cols are required')
      }
    })

    it('should reject invalid dimensions', () => {
      const result = validateResizeMessage({
        rows: TEST_SSH.INVALID_VALUES.COLS_TOO_HIGH,
        cols: TEST_SSH.TERMINAL.LARGE_COLS
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Rows must be an integer')
      }
    })

    it('should reject non-object data', () => {
      const result = validateResizeMessage('invalid')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('must be an object')
      }
    })
  })

  describe('validateExecMessage', () => {
    it('should validate complete exec command', () => {
      const result = validateExecMessage({
        command: TEST_SSH.COMMANDS.LIST_FILES,
        pty: true,
        term: 'xterm',
        cols: TEST_SSH.TERMINAL.DEFAULT_COLS,
        rows: TEST_SSH.TERMINAL.DEFAULT_ROWS,
        env: TEST_SSH.ENV_VARS,
        timeoutMs: TEST_SSH.TIMEOUT_MS
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe(TEST_SSH.COMMANDS.LIST_FILES)
        expect(result.value.pty).toBe(true)
        expect(result.value.term).toBe('xterm')
        expect(result.value.cols).toBe(TEST_SSH.TERMINAL.DEFAULT_COLS)
        expect(result.value.rows).toBe(TEST_SSH.TERMINAL.DEFAULT_ROWS)
        expect(result.value.env).toEqual(TEST_SSH.ENV_VARS)
        expect(result.value.timeoutMs).toBe(TEST_SSH.TIMEOUT_MS)
      }
    })

    it('should validate minimal exec command', () => {
      const result = validateExecMessage({
        command: TEST_SSH.COMMANDS.ECHO_TEST
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe(TEST_SSH.COMMANDS.ECHO_TEST)
        expect(result.value.pty).toBeUndefined()
        expect(result.value.env).toBeUndefined()
      }
    })

    it('should trim command whitespace', () => {
      const result = validateExecMessage({
        command: `  ${TEST_SSH.COMMANDS.LIST_FILES}  `
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.command).toBe(TEST_SSH.COMMANDS.LIST_FILES)
      }
    })

    it('should reject missing command', () => {
      const result = validateExecMessage({
        pty: true
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Command is required')
      }
    })

    it('should reject empty command', () => {
      const result = validateExecMessage({
        command: '   '
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Command is required')
      }
    })

    it('should handle boolean conversion for pty', () => {
      const result1 = validateExecMessage({
        command: 'test',
        pty: 'true'
      })

      const result2 = validateExecMessage({
        command: 'test',
        pty: 0
      })

      expect(result1.ok).toBe(true)
      if (result1.ok) {
        expect(result1.value.pty).toBe(true)
      }

      expect(result2.ok).toBe(true)
      if (result2.ok) {
        expect(result2.value.pty).toBe(false)
      }
    })

    it('should validate environment variables', () => {
      const result = validateExecMessage({
        command: 'test',
        env: {
          VALID_VAR: 'value',
          ANOTHER_VAR: 123,
          _PRIVATE_VAR: 'test'
        }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.env).toEqual({
          VALID_VAR: 'value',
          ANOTHER_VAR: '123',
          _PRIVATE_VAR: 'test'
        })
      }
    })

    it('should filter invalid environment variable names', () => {
      const result = validateExecMessage({
        command: 'test',
        env: {
          'valid-var': 'value', // invalid: contains hyphen
          '123invalid': 'value', // invalid: starts with number
          'VALID_VAR': 'value',
          '': 'empty', // invalid: empty key
          'with space': 'value' // invalid: contains space
        }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.env).toEqual({
          VALID_VAR: 'value'
        })
      }
    })

    it('should limit environment variables to 50', () => {
      const manyVars: Record<string, string> = {}
      for (let i = 0; i < 100; i++) {
        manyVars[`VAR_${i}`] = `value_${i}`
      }

      const result = validateExecMessage({
        command: 'test',
        env: manyVars
      })

      expect(result.ok).toBe(true)
      if (result.ok && result.value.env !== undefined) {
        expect(Object.keys(result.value.env).length).toBe(50)
      }
    })

    it('should validate timeout', () => {
      const result = validateExecMessage({
        command: 'test',
        timeoutMs: TEST_SSH.TIMEOUT_MS * 2
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.timeoutMs).toBe(TEST_SSH.TIMEOUT_MS * 2)
      }
    })

    it('should ignore invalid timeout values', () => {
      const result = validateExecMessage({
        command: 'test',
        timeoutMs: 'invalid'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.timeoutMs).toBeUndefined()
      }
    })
  })

  describe('validateControlMessage', () => {
    it('should validate valid control actions', () => {
      const actions = [CONTROL_ACTIONS.REAUTH, CONTROL_ACTIONS.CLEAR_CREDENTIALS, CONTROL_ACTIONS.DISCONNECT]

      for (const action of actions) {
        const result = validateControlMessage({ action })
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value.action).toBe(action)
        }
      }
    })

    it('should normalize action case', () => {
      const result = validateControlMessage({ action: CONTROL_ACTIONS.REAUTH.toUpperCase() })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.action).toBe(CONTROL_ACTIONS.REAUTH)
      }
    })

    it('should trim action whitespace', () => {
      const result = validateControlMessage({ action: `  ${CONTROL_ACTIONS.DISCONNECT}  ` })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.action).toBe(CONTROL_ACTIONS.DISCONNECT)
      }
    })

    it('should reject missing action', () => {
      const result = validateControlMessage({})

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Action is required')
      }
    })

    it('should reject empty action', () => {
      const result = validateControlMessage({ action: '   ' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Action is required')
      }
    })

    it('should reject unknown action', () => {
      const result = validateControlMessage({ action: 'unknown' })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Unknown control action')
      }
    })

    it('should reject non-object data', () => {
      const result = validateControlMessage('invalid')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('must be an object')
      }
    })
  })
})