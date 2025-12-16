// tests/unit/socket/handlers/prompt-handler.vitest.ts
// Unit tests for pure prompt handler functions

import { describe, it, expect } from 'vitest'
import {
  generatePromptId,
  createInputPrompt,
  createConfirmPrompt,
  createNoticePrompt,
  createToastPrompt,
  createCustomPrompt
} from '../../../../app/socket/handlers/prompt-handler.js'
import {
  PROMPT_TYPES,
  PROMPT_SEVERITY,
  PROMPT_TIMEOUTS
} from '../../../../app/constants/prompt.js'
import { PROMPT_TEST_CONSTANTS } from '../../../test-constants.js'

describe('Prompt Handler', () => {
  describe('generatePromptId', () => {
    it('should generate unique UUIDs', () => {
      const id1 = generatePromptId()
      const id2 = generatePromptId()

      expect(id1).not.toBe(id2)
    })

    it('should generate valid UUID v4 format', () => {
      const id = generatePromptId()
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

      expect(uuidV4Regex.test(id)).toBe(true)
    })
  })

  describe('createInputPrompt', () => {
    it('should create input prompt with required fields', () => {
      const result = createInputPrompt({
        title: PROMPT_TEST_CONSTANTS.TITLES.NORMAL,
        inputs: [
          { key: 'username', label: 'Username', type: 'text', required: true }
        ]
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.type).toBe(PROMPT_TYPES.INPUT)
        expect(result.value.title).toBe(PROMPT_TEST_CONSTANTS.TITLES.NORMAL)
        expect(result.value.buttons).toHaveLength(2)
        expect(result.value.inputs).toHaveLength(1)
      }
    })

    it('should use default button labels', () => {
      const result = createInputPrompt({
        title: 'Test',
        inputs: []
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.buttons?.[0]?.label).toBe('Submit')
        expect(result.value.buttons?.[1]?.label).toBe('Cancel')
        expect(result.value.buttons?.[0]?.action).toBe('submit')
        expect(result.value.buttons?.[1]?.action).toBe('cancel')
      }
    })

    it('should allow custom button labels', () => {
      const result = createInputPrompt({
        title: 'Test',
        inputs: [],
        submitLabel: 'Connect',
        cancelLabel: 'Back'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.buttons?.[0]?.label).toBe('Connect')
        expect(result.value.buttons?.[1]?.label).toBe('Back')
      }
    })

    it('should set default severity to info', () => {
      const result = createInputPrompt({
        title: 'Test',
        inputs: []
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.severity).toBe(PROMPT_SEVERITY.INFO)
      }
    })

    it('should set autoFocus to true by default', () => {
      const result = createInputPrompt({
        title: 'Test',
        inputs: []
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.autoFocus).toBe(true)
      }
    })

    it('should use default timeout', () => {
      const result = createInputPrompt({
        title: 'Test',
        inputs: []
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.timeout).toBe(PROMPT_TIMEOUTS.DEFAULT_PROMPT_MS)
      }
    })

    it('should allow custom timeout', () => {
      const result = createInputPrompt({
        title: 'Test',
        inputs: [],
        timeout: 60000
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.timeout).toBe(60000)
      }
    })

    it('should include message when provided', () => {
      const result = createInputPrompt({
        title: 'Test',
        message: PROMPT_TEST_CONSTANTS.MESSAGES.NORMAL,
        inputs: []
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.message).toBe(PROMPT_TEST_CONSTANTS.MESSAGES.NORMAL)
      }
    })

    it('should include icon when provided', () => {
      const result = createInputPrompt({
        title: 'Test',
        inputs: [],
        icon: 'lock'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.icon).toBe('lock')
      }
    })
  })

  describe('createConfirmPrompt', () => {
    it('should create confirm prompt with default buttons', () => {
      const result = createConfirmPrompt({
        title: 'Delete File?',
        message: 'Are you sure?'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.type).toBe(PROMPT_TYPES.CONFIRM)
        expect(result.value.buttons).toHaveLength(2)
        expect(result.value.buttons?.[0]?.label).toBe('Yes')
        expect(result.value.buttons?.[0]?.action).toBe('confirm')
        expect(result.value.buttons?.[1]?.label).toBe('No')
        expect(result.value.buttons?.[1]?.action).toBe('cancel')
      }
    })

    it('should allow custom button labels', () => {
      const result = createConfirmPrompt({
        title: 'Delete',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.buttons?.[0]?.label).toBe('Delete')
        expect(result.value.buttons?.[1]?.label).toBe('Keep')
      }
    })

    it('should set closeOnBackdrop to true', () => {
      const result = createConfirmPrompt({
        title: 'Test'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.closeOnBackdrop).toBe(true)
      }
    })
  })

  describe('createNoticePrompt', () => {
    it('should create notice prompt with OK button', () => {
      const result = createNoticePrompt({
        title: 'Information',
        message: 'Operation complete'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.type).toBe(PROMPT_TYPES.NOTICE)
        expect(result.value.buttons).toHaveLength(1)
        expect(result.value.buttons?.[0]?.label).toBe('OK')
        expect(result.value.buttons?.[0]?.action).toBe('ok')
      }
    })

    it('should allow custom OK label', () => {
      const result = createNoticePrompt({
        title: 'Test',
        okLabel: 'Got it'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.buttons?.[0]?.label).toBe('Got it')
      }
    })
  })

  describe('createToastPrompt', () => {
    it('should create toast prompt without buttons', () => {
      const result = createToastPrompt({
        title: 'Upload complete'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.type).toBe(PROMPT_TYPES.TOAST)
        expect(result.value.buttons).toBeUndefined()
      }
    })

    it('should use toast default timeout', () => {
      const result = createToastPrompt({
        title: 'Test'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.timeout).toBe(PROMPT_TIMEOUTS.DEFAULT_TOAST_MS)
      }
    })

    it('should set autoFocus to false', () => {
      const result = createToastPrompt({
        title: 'Test'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.autoFocus).toBe(false)
      }
    })

    it('should include severity when provided', () => {
      const result = createToastPrompt({
        title: 'Error',
        severity: 'error'
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.severity).toBe(PROMPT_SEVERITY.ERROR)
      }
    })
  })

  describe('createCustomPrompt', () => {
    it('should create custom prompt with all options', () => {
      const result = createCustomPrompt('confirm', 'Custom Title', {
        message: 'Custom message',
        buttons: [
          { action: 'yes', label: 'Yes', variant: 'primary' },
          { action: 'no', label: 'No', variant: 'secondary' },
          { action: 'maybe', label: 'Maybe', variant: 'danger' }
        ],
        severity: 'warning',
        icon: 'question',
        timeout: 30000
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.type).toBe('confirm')
        expect(result.value.title).toBe('Custom Title')
        expect(result.value.message).toBe('Custom message')
        expect(result.value.buttons).toHaveLength(3)
        expect(result.value.severity).toBe('warning')
        expect(result.value.icon).toBe('question')
        expect(result.value.timeout).toBe(30000)
      }
    })
  })
})
