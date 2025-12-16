// tests/unit/socket/handlers/prompt-validator.vitest.ts
// Unit tests for prompt validation functions

import { describe, it, expect } from 'vitest'
import {
  validatePromptResponse,
  validateResponseAction,
  validateResponseInputKeys,
  validateIcon,
  validateTitle,
  validateMessage,
  validatePromptId
} from '../../../../app/socket/handlers/prompt-validator.js'
import {
  PROMPT_LIMITS,
  ALLOWED_PROMPT_ICONS
} from '../../../../app/constants/prompt.js'
import { PROMPT_TEST_CONSTANTS } from '../../../test-constants.js'
import type { PromptButton, PromptInput } from '../../../../app/types/contracts/v1/socket.js'

describe('Prompt Validator', () => {
  describe('validatePromptResponse', () => {
    it('should accept valid response with id and action', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.action).toBe('submit')
      }
    })

    it('should accept valid response with inputs', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit',
        inputs: { username: 'testuser', password: 'testpass' }
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.inputs).toEqual({ username: 'testuser', password: 'testpass' })
      }
    })

    it('should reject non-object data', () => {
      const result = validatePromptResponse('invalid')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Prompt response must be an object')
      }
    })

    it('should reject null data', () => {
      const result = validatePromptResponse(null)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Prompt response must be an object')
      }
    })

    it('should reject missing id', () => {
      const result = validatePromptResponse({
        action: 'submit'
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Invalid or missing prompt ID')
      }
    })

    it('should reject missing action', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Action must be a string')
      }
    })

    it('should reject empty action', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: ''
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Action is required')
      }
    })

    it('should reject invalid action format', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: '123invalid'
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid action format')
      }
    })

    it('should reject action exceeding max length', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'a'.repeat(PROMPT_LIMITS.MAX_ACTION_LENGTH + 1)
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('exceeds maximum length')
      }
    })

    it('should reject inputs that are not an object', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit',
        inputs: 'not-an-object'
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Inputs must be an object')
      }
    })

    it('should reject inputs with invalid key format', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit',
        inputs: { '123invalid': 'value' }
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Invalid input key format')
      }
    })

    it('should reject inputs with non-string values', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit',
        inputs: { validKey: 123 }
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('must be a string')
      }
    })

    it('should reject inputs with HTML content', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit',
        inputs: { username: PROMPT_TEST_CONSTANTS.HTML_INJECTION.SCRIPT }
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('invalid HTML-like content')
      }
    })

    it('should reject inputs exceeding value length limit', () => {
      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit',
        inputs: { username: 'a'.repeat(PROMPT_LIMITS.MAX_INPUT_VALUE_LENGTH + 1) }
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('exceeds maximum length')
      }
    })

    it('should reject too many inputs', () => {
      const inputs: Record<string, string> = {}
      for (let i = 0; i <= PROMPT_LIMITS.MAX_INPUTS; i++) {
        inputs[`field${i}`] = 'value'
      }

      const result = validatePromptResponse({
        id: PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID,
        action: 'submit',
        inputs
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Too many input values')
      }
    })
  })

  describe('validateResponseAction', () => {
    const buttons: readonly PromptButton[] = [
      { action: 'submit', label: 'Submit' },
      { action: 'cancel', label: 'Cancel' }
    ]

    it('should accept valid button action', () => {
      const result = validateResponseAction('submit', buttons)

      expect(result.ok).toBe(true)
    })

    it('should accept dismissed action', () => {
      const result = validateResponseAction('dismissed', buttons)

      expect(result.ok).toBe(true)
    })

    it('should accept timeout action', () => {
      const result = validateResponseAction('timeout', buttons)

      expect(result.ok).toBe(true)
    })

    it('should reject unknown action', () => {
      const result = validateResponseAction('unknown', buttons)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain("Invalid action 'unknown'")
        expect(result.error.message).toContain('Expected one of')
      }
    })
  })

  describe('validateResponseInputKeys', () => {
    const inputs: readonly PromptInput[] = [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'remember', label: 'Remember me', type: 'text', required: false }
    ]

    it('should accept valid input keys', () => {
      const result = validateResponseInputKeys(
        { username: 'test', password: 'pass' },
        inputs
      )

      expect(result.ok).toBe(true)
    })

    it('should accept all inputs including optional', () => {
      const result = validateResponseInputKeys(
        { username: 'test', password: 'pass', remember: 'yes' },
        inputs
      )

      expect(result.ok).toBe(true)
    })

    it('should reject unexpected input keys', () => {
      const result = validateResponseInputKeys(
        { username: 'test', password: 'pass', extraField: 'value' },
        inputs
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Unexpected input key: extraField')
      }
    })

    it('should reject missing required inputs', () => {
      const result = validateResponseInputKeys(
        { username: 'test' },
        inputs
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Missing or empty required input: password')
      }
    })

    it('should reject empty required inputs', () => {
      const result = validateResponseInputKeys(
        { username: 'test', password: '' },
        inputs
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Missing or empty required input: password')
      }
    })

    it('should accept no inputs when none expected', () => {
      const result = validateResponseInputKeys(undefined, undefined)

      expect(result.ok).toBe(true)
    })

    it('should accept no inputs when none required', () => {
      const optionalInputs: readonly PromptInput[] = [
        { key: 'optional', label: 'Optional', type: 'text', required: false }
      ]

      const result = validateResponseInputKeys(undefined, optionalInputs)

      expect(result.ok).toBe(true)
    })

    it('should reject unexpected inputs when none expected', () => {
      const result = validateResponseInputKeys(
        { unexpected: 'value' },
        undefined
      )

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Unexpected input values provided')
      }
    })
  })

  describe('validateIcon', () => {
    it('should accept undefined icon', () => {
      const result = validateIcon(undefined)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeUndefined()
      }
    })

    it('should accept valid icon from whitelist', () => {
      // Get first icon from whitelist
      const validIcon = Array.from(ALLOWED_PROMPT_ICONS)[0]
      const result = validateIcon(validIcon)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(validIcon)
      }
    })

    it('should accept common icons', () => {
      for (const icon of ['lock', 'key', 'info', 'warning', 'error', 'success']) {
        const result = validateIcon(icon)
        expect(result.ok).toBe(true)
      }
    })

    it('should reject icon not in whitelist', () => {
      const result = validateIcon('not-a-valid-icon-name-xyz')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('not in allowed icon list')
      }
    })

    it('should reject icon exceeding max length', () => {
      const result = validateIcon('a'.repeat(PROMPT_LIMITS.MAX_ICON_LENGTH + 1))

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('exceeds maximum length')
      }
    })
  })

  describe('validateTitle', () => {
    it('should accept valid title', () => {
      const result = validateTitle(PROMPT_TEST_CONSTANTS.TITLES.NORMAL)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(PROMPT_TEST_CONSTANTS.TITLES.NORMAL)
      }
    })

    it('should reject non-string title', () => {
      const result = validateTitle(123)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Title must be a string')
      }
    })

    it('should reject empty title', () => {
      const result = validateTitle('')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Title is required')
      }
    })

    it('should reject title exceeding max length', () => {
      const result = validateTitle('a'.repeat(PROMPT_LIMITS.MAX_TITLE_LENGTH + 1))

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('exceeds maximum length')
      }
    })

    it('should reject title with HTML content', () => {
      const result = validateTitle(PROMPT_TEST_CONSTANTS.HTML_INJECTION.SCRIPT)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('invalid HTML-like content')
      }
    })
  })

  describe('validateMessage', () => {
    it('should accept undefined message', () => {
      const result = validateMessage(undefined)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeUndefined()
      }
    })

    it('should accept null message', () => {
      const result = validateMessage(null)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBeUndefined()
      }
    })

    it('should accept valid message', () => {
      const result = validateMessage(PROMPT_TEST_CONSTANTS.MESSAGES.NORMAL)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(PROMPT_TEST_CONSTANTS.MESSAGES.NORMAL)
      }
    })

    it('should reject non-string message', () => {
      const result = validateMessage(123)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Message must be a string')
      }
    })

    it('should reject message exceeding max length', () => {
      const result = validateMessage('a'.repeat(PROMPT_LIMITS.MAX_MESSAGE_LENGTH + 1))

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('exceeds maximum length')
      }
    })

    it('should reject message with HTML content', () => {
      const result = validateMessage(PROMPT_TEST_CONSTANTS.HTML_INJECTION.SCRIPT)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('invalid HTML-like content')
      }
    })
  })

  describe('validatePromptId', () => {
    it('should accept valid UUID v4', () => {
      const result = validatePromptId(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)

      expect(result.ok).toBe(true)
    })

    it('should reject non-string id', () => {
      const result = validatePromptId(123)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Prompt ID must be a string')
      }
    })

    it('should reject invalid UUID format', () => {
      const result = validatePromptId('not-a-uuid')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Prompt ID must be a valid UUID v4')
      }
    })

    it('should reject UUID v1 format', () => {
      // UUID v1 has version 1 in position 13
      const result = validatePromptId('550e8400-e29b-11d4-a716-446655440000')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Prompt ID must be a valid UUID v4')
      }
    })
  })
})
