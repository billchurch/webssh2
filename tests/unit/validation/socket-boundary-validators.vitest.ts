// tests/unit/validation/socket-boundary-validators.vitest.ts
// Bounds and shapes enforced on inbound socket event payloads

import { describe, it, expect } from 'vitest'
import {
  validateAuthMessage,
  validateAuthenticateMessage,
  validateTerminalSettingsMessage,
  validateTerminalMessage,
  validateExecMessage,
  validateExecRequestMessage,
  validateDataMessage
} from '../../../app/validation/socket-messages.js'
import { VALIDATION_LIMITS } from '../../../app/constants/validation.js'
import { TEST_SSH, TEST_USERNAME, TEST_PASSWORD } from '../../test-constants.js'

const baseCredentials = {
  username: TEST_USERNAME,
  host: TEST_SSH.HOST,
  port: TEST_SSH.PORT
}

const repeat = (length: number): string => 'a'.repeat(length)

describe('validateAuthMessage bounds', () => {
  it.each([
    ['username', VALIDATION_LIMITS.MAX_USERNAME_LENGTH],
    ['host', VALIDATION_LIMITS.MAX_HOSTNAME_LENGTH],
    ['password', VALIDATION_LIMITS.MAX_PASSWORD_LENGTH],
    ['privateKey', VALIDATION_LIMITS.MAX_PRIVATE_KEY_LENGTH],
    ['passphrase', VALIDATION_LIMITS.MAX_PASSPHRASE_LENGTH],
    ['term', VALIDATION_LIMITS.MAX_TERMINAL_TYPE_LENGTH]
  ])('accepts %s at the limit and rejects it above', (field, limit) => {
    expect(validateAuthMessage({ ...baseCredentials, [field]: repeat(limit) }).ok).toBe(true)

    const result = validateAuthMessage({ ...baseCredentials, [field]: repeat(limit + 1) })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe(`${field} exceeds maximum length of ${limit}`)
    }
  })

  it.each(['username', 'host'])('counts whitespace padding in %s against the limit', (field) => {
    const padded = `${' '.repeat(500_000)}${TEST_USERNAME}`
    const result = validateAuthMessage({ ...baseCredentials, [field]: padded })

    expect(result.ok).toBe(false)
  })

  it('does not echo an invalid port value', () => {
    const port = repeat(10_000)
    const result = validateAuthMessage({ ...baseCredentials, port })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe('Invalid port')
    }
  })

  it('keeps forwardAllKeyboardInteractivePrompts only when it is true', () => {
    const forwarded = validateAuthMessage({ ...baseCredentials, forwardAllKeyboardInteractivePrompts: true })
    const ignored = validateAuthMessage({ ...baseCredentials, forwardAllKeyboardInteractivePrompts: 'yes' })

    expect(forwarded.ok && forwarded.value.forwardAllKeyboardInteractivePrompts).toBe(true)
    expect(ignored.ok && ignored.value.forwardAllKeyboardInteractivePrompts).toBeUndefined()
  })

  it('drops fields the server does not use', () => {
    const result = validateAuthMessage({ ...baseCredentials, password: TEST_PASSWORD, extra: { nested: true } })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ ...baseCredentials, password: TEST_PASSWORD })
    }
  })
})

describe('validateAuthenticateMessage', () => {
  it('returns credentials for a credential payload', () => {
    const result = validateAuthenticateMessage({ ...baseCredentials, password: TEST_PASSWORD })

    expect(result).toEqual({
      ok: true,
      value: { kind: 'credentials', credentials: { ...baseCredentials, password: TEST_PASSWORD } }
    })
  })

  it('returns keyboard-interactive responses', () => {
    const result = validateAuthenticateMessage({ responses: [TEST_USERNAME, TEST_PASSWORD] })

    expect(result).toEqual({
      ok: true,
      value: { kind: 'keyboard-interactive', responses: [TEST_USERNAME, TEST_PASSWORD] }
    })
  })

  it('treats a payload with responses as keyboard-interactive even with credential fields', () => {
    const result = validateAuthenticateMessage({ ...baseCredentials, responses: [TEST_USERNAME, TEST_PASSWORD] })

    expect(result.ok && result.value.kind).toBe('keyboard-interactive')
  })

  it.each([
    ['null', null],
    ['a string', 'creds'],
    ['an array', [TEST_USERNAME]],
    ['string responses', { responses: TEST_PASSWORD }],
    ['null responses', { responses: null }],
    ['numeric responses', { responses: [1] }],
    ['too many responses', { responses: Array.from({ length: VALIDATION_LIMITS.MAX_KEYBOARD_INTERACTIVE_RESPONSES + 1 }, () => 'a') }],
    ['an oversized response', { responses: [repeat(VALIDATION_LIMITS.MAX_PASSWORD_LENGTH + 1)] }],
    ['an empty object', {}]
  ])('rejects %s', (_label, payload) => {
    expect(validateAuthenticateMessage(payload).ok).toBe(false)
  })
})

describe('validateTerminalSettingsMessage', () => {
  it('returns only the fields that were sent', () => {
    expect(validateTerminalSettingsMessage({})).toEqual({ ok: true, value: {} })
    expect(validateTerminalSettingsMessage({ rows: 30 })).toEqual({ ok: true, value: { rows: 30 } })
  })

  it('treats zero dimensions as not provided', () => {
    expect(validateTerminalSettingsMessage({ rows: 0, cols: 0 })).toEqual({ ok: true, value: {} })
    expect(validateTerminalMessage({ rows: 0, cols: 0 })).toEqual({ ok: true, value: { rows: 24, cols: 80 } })
  })

  it.each([
    ['negative rows', { rows: -1 }],
    ['rows above the limit', { rows: VALIDATION_LIMITS.MAX_TERMINAL_DIMENSION + 1 }],
    ['fractional cols', { cols: 1.5 }],
    ['an oversized term', { term: repeat(VALIDATION_LIMITS.MAX_TERMINAL_TYPE_LENGTH + 1) }],
    ['a non-string term', { term: ['xterm'] }]
  ])('rejects %s', (_label, payload) => {
    expect(validateTerminalSettingsMessage(payload).ok).toBe(false)
  })
})

describe('validateExecMessage bounds', () => {
  it('counts whitespace padding against the length limit', () => {
    const padded = `${' '.repeat(500_000)}id`

    expect(validateExecMessage({ command: padded }).ok).toBe(false)
    expect(validateExecRequestMessage({ command: padded }).ok).toBe(false)
    expect(validateExecRequestMessage({ command: `${' '.repeat(VALIDATION_LIMITS.MAX_COMMAND_LENGTH)}id` }).ok).toBe(false)
  })

  it('rejects a command above the length limit', () => {
    expect(validateExecMessage({ command: repeat(VALIDATION_LIMITS.MAX_COMMAND_LENGTH) }).ok).toBe(true)
    expect(validateExecMessage({ command: repeat(VALIDATION_LIMITS.MAX_COMMAND_LENGTH + 1) }).ok).toBe(false)
  })
})

describe('validateExecRequestMessage', () => {
  it('returns the command as sent and ignores other fields', () => {
    expect(validateExecRequestMessage({ command: ' ls ', cols: 0, pty: 'x' })).toEqual({
      ok: true,
      value: { command: ' ls ' }
    })
  })

  it.each([
    ['null', null],
    ['a non-string command', { command: 1 }],
    ['a blank command', { command: '  ' }],
    ['an oversized command', { command: repeat(VALIDATION_LIMITS.MAX_COMMAND_LENGTH + 1) }]
  ])('rejects %s', (_label, payload) => {
    expect(validateExecRequestMessage(payload).ok).toBe(false)
  })
})

describe('validateDataMessage', () => {
  it('accepts strings and buffers', () => {
    expect(validateDataMessage('ls\r').ok).toBe(true)
    expect(validateDataMessage(Buffer.from('ls\r')).ok).toBe(true)
  })

  it.each([null, undefined, 1, {}, ['ls']])('rejects %o', (payload) => {
    expect(validateDataMessage(payload).ok).toBe(false)
  })
})
