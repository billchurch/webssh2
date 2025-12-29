// tests/unit/socket/handlers/prompt-tracker.vitest.ts
// Unit tests for prompt tracker

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPromptTracker, type PromptTracker } from '../../../../app/socket/handlers/prompt-tracker.js'
import { createPromptId, createSocketId } from '../../../../app/types/branded.js'
import { PROMPT_LIMITS, PROMPT_TIMEOUTS } from '../../../../app/constants/prompt.js'
import type { PromptPayload } from '../../../../app/types/contracts/v1/socket.js'
import { PROMPT_TEST_CONSTANTS } from '../../../test-constants.js'

const createTestPayload = (id: string, options?: Partial<PromptPayload>): PromptPayload => ({
  id: createPromptId(id),
  type: 'input',
  title: PROMPT_TEST_CONSTANTS.TITLES.NORMAL,
  buttons: [
    { action: 'submit', label: 'Submit' },
    { action: 'cancel', label: 'Cancel' }
  ],
  inputs: [
    { id: 'username', label: 'Username', type: 'text', required: true }
  ],
  ...options
})

const socketId1 = createSocketId('socket-1')
const socketId2 = createSocketId('socket-2')

describe('Prompt Tracker', () => {
  let tracker: PromptTracker

  beforeEach(() => {
    tracker = createPromptTracker()
    vi.useFakeTimers()
  })

  describe('track', () => {
    it('should track a new prompt', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)
      const result = tracker.track(socketId1, payload)

      expect(result.ok).toBe(true)
      expect(tracker.getPendingCount(socketId1)).toBe(1)
    })

    it('should track multiple prompts for same socket', () => {
      const payload1 = createTestPayload('11111111-1111-4111-8111-111111111111')
      const payload2 = createTestPayload('22222222-2222-4222-8222-222222222222')

      tracker.track(socketId1, payload1)
      tracker.track(socketId1, payload2)

      expect(tracker.getPendingCount(socketId1)).toBe(2)
    })

    it('should track prompts for different sockets independently', () => {
      const payload1 = createTestPayload('11111111-1111-4111-8111-111111111111')
      const payload2 = createTestPayload('22222222-2222-4222-8222-222222222222')

      tracker.track(socketId1, payload1)
      tracker.track(socketId2, payload2)

      expect(tracker.getPendingCount(socketId1)).toBe(1)
      expect(tracker.getPendingCount(socketId2)).toBe(1)
    })

    it('should reject when max pending prompts exceeded', () => {
      // Fill up to max
      for (let i = 0; i < PROMPT_LIMITS.MAX_PENDING_PROMPTS_PER_SOCKET; i++) {
        const payload = createTestPayload(`1111111${i}-1111-4111-8111-111111111111`)
        tracker.track(socketId1, payload)
      }

      // Try to add one more
      const overflowPayload = createTestPayload('overflow1-1111-4111-8111-111111111111')
      const result = tracker.track(socketId1, overflowPayload)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Too many pending prompts')
      }
    })

    it('should use custom timeout from payload', () => {
      const customTimeout = 60000
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID, {
        timeout: customTimeout
      })

      tracker.track(socketId1, payload)
      const tracked = tracker.get(payload.id)

      expect(tracked).toBeDefined()
      expect(tracked?.timeoutAt).toBe(Date.now() + customTimeout)
    })

    it('should use default timeout when not specified', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)
      delete (payload as { timeout?: number }).timeout

      tracker.track(socketId1, payload)
      const tracked = tracker.get(payload.id)

      expect(tracked).toBeDefined()
      expect(tracked?.timeoutAt).toBe(Date.now() + PROMPT_TIMEOUTS.DEFAULT_PROMPT_MS)
    })

    it('should extract expected buttons', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)

      tracker.track(socketId1, payload)
      const tracked = tracker.get(payload.id)

      expect(tracked?.expectedButtons).toEqual(['submit', 'cancel'])
    })

    it('should extract expected inputs', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)

      tracker.track(socketId1, payload)
      const tracked = tracker.get(payload.id)

      expect(tracked?.expectedInputs).toEqual(['username'])
    })
  })

  describe('validate', () => {
    it('should validate prompt owned by socket', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)
      tracker.track(socketId1, payload)

      const result = tracker.validate(socketId1, payload.id)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.id).toBe(payload.id)
        expect(result.value.socketId).toBe(socketId1)
      }
    })

    it('should reject unknown prompt id', () => {
      const unknownId = createPromptId('unknown1-1111-4111-8111-111111111111')
      const result = tracker.validate(socketId1, unknownId)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Unknown or already responded prompt ID')
      }
    })

    it('should reject prompt owned by different socket', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)
      tracker.track(socketId1, payload)

      const result = tracker.validate(socketId2, payload.id)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Prompt ID does not belong to this socket')
      }
    })

    it('should reject expired prompt', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID, {
        timeout: 1000
      })
      tracker.track(socketId1, payload)

      // Advance time past timeout
      vi.advanceTimersByTime(1001)

      const result = tracker.validate(socketId1, payload.id)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Prompt has expired')
      }
    })

    it('should remove expired prompt during validation', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID, {
        timeout: 1000
      })
      tracker.track(socketId1, payload)

      // Advance time past timeout
      vi.advanceTimersByTime(1001)

      // Validate triggers cleanup
      tracker.validate(socketId1, payload.id)

      // Prompt should be removed
      expect(tracker.get(payload.id)).toBeUndefined()
      expect(tracker.getPendingCount(socketId1)).toBe(0)
    })
  })

  describe('remove', () => {
    it('should remove tracked prompt', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)
      tracker.track(socketId1, payload)

      tracker.remove(payload.id)

      expect(tracker.get(payload.id)).toBeUndefined()
      expect(tracker.getPendingCount(socketId1)).toBe(0)
    })

    it('should handle removing non-existent prompt', () => {
      const nonExistentId = createPromptId('nonexist-1111-4111-8111-111111111111')

      // Should not throw
      expect(() => tracker.remove(nonExistentId)).not.toThrow()
    })

    it('should clean up socket index when last prompt removed', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)
      tracker.track(socketId1, payload)
      tracker.remove(payload.id)

      // getPendingCount should return 0 for cleaned socket
      expect(tracker.getPendingCount(socketId1)).toBe(0)
    })

    it('should not affect other prompts for same socket', () => {
      const payload1 = createTestPayload('11111111-1111-4111-8111-111111111111')
      const payload2 = createTestPayload('22222222-2222-4222-8222-222222222222')

      tracker.track(socketId1, payload1)
      tracker.track(socketId1, payload2)
      tracker.remove(payload1.id)

      expect(tracker.get(payload1.id)).toBeUndefined()
      expect(tracker.get(payload2.id)).toBeDefined()
      expect(tracker.getPendingCount(socketId1)).toBe(1)
    })
  })

  describe('removeAllForSocket', () => {
    it('should remove all prompts for socket', () => {
      const payload1 = createTestPayload('11111111-1111-4111-8111-111111111111')
      const payload2 = createTestPayload('22222222-2222-4222-8222-222222222222')

      tracker.track(socketId1, payload1)
      tracker.track(socketId1, payload2)
      tracker.removeAllForSocket(socketId1)

      expect(tracker.get(payload1.id)).toBeUndefined()
      expect(tracker.get(payload2.id)).toBeUndefined()
      expect(tracker.getPendingCount(socketId1)).toBe(0)
    })

    it('should not affect other sockets', () => {
      const payload1 = createTestPayload('11111111-1111-4111-8111-111111111111')
      const payload2 = createTestPayload('22222222-2222-4222-8222-222222222222')

      tracker.track(socketId1, payload1)
      tracker.track(socketId2, payload2)
      tracker.removeAllForSocket(socketId1)

      expect(tracker.get(payload1.id)).toBeUndefined()
      expect(tracker.get(payload2.id)).toBeDefined()
      expect(tracker.getPendingCount(socketId2)).toBe(1)
    })

    it('should handle removing from socket with no prompts', () => {
      // Should not throw
      expect(() => tracker.removeAllForSocket(socketId1)).not.toThrow()
    })
  })

  describe('getPendingCount', () => {
    it('should return 0 for socket with no prompts', () => {
      expect(tracker.getPendingCount(socketId1)).toBe(0)
    })

    it('should return correct count after tracking', () => {
      const payload1 = createTestPayload('11111111-1111-4111-8111-111111111111')
      const payload2 = createTestPayload('22222222-2222-4222-8222-222222222222')

      tracker.track(socketId1, payload1)
      expect(tracker.getPendingCount(socketId1)).toBe(1)

      tracker.track(socketId1, payload2)
      expect(tracker.getPendingCount(socketId1)).toBe(2)
    })

    it('should return correct count after removal', () => {
      const payload1 = createTestPayload('11111111-1111-4111-8111-111111111111')
      const payload2 = createTestPayload('22222222-2222-4222-8222-222222222222')

      tracker.track(socketId1, payload1)
      tracker.track(socketId1, payload2)
      tracker.remove(payload1.id)

      expect(tracker.getPendingCount(socketId1)).toBe(1)
    })
  })

  describe('get', () => {
    it('should return tracked prompt', () => {
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID)
      tracker.track(socketId1, payload)

      const tracked = tracker.get(payload.id)

      expect(tracked).toBeDefined()
      expect(tracked?.id).toBe(payload.id)
      expect(tracked?.socketId).toBe(socketId1)
      expect(tracked?.payload).toBe(payload)
    })

    it('should return undefined for non-existent prompt', () => {
      const nonExistentId = createPromptId('nonexist-1111-4111-8111-111111111111')

      expect(tracker.get(nonExistentId)).toBeUndefined()
    })

    it('should include timestamp information', () => {
      const now = Date.now()
      const payload = createTestPayload(PROMPT_TEST_CONSTANTS.VALID_PROMPT_ID, {
        timeout: 30000
      })
      tracker.track(socketId1, payload)

      const tracked = tracker.get(payload.id)

      expect(tracked?.createdAt).toBe(now)
      expect(tracked?.timeoutAt).toBe(now + 30000)
    })
  })
})
