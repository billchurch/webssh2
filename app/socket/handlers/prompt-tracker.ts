/**
 * Prompt Tracker
 *
 * Tracks pending prompts per socket for security validation.
 * Ensures prompt responses are only accepted from the socket that received them.
 *
 * @module socket/handlers/prompt-tracker
 */

import type { PromptId, SocketId } from '../../types/branded.js'
import type { PromptPayload } from '../../types/contracts/v1/socket.js'
import type { Result } from '../../types/result.js'
import { PROMPT_LIMITS, PROMPT_TIMEOUTS } from '../../constants/prompt.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Information about a tracked prompt
 */
export interface TrackedPrompt {
  /** Unique prompt identifier */
  readonly id: PromptId
  /** Socket that received this prompt */
  readonly socketId: SocketId
  /** Original prompt payload */
  readonly payload: PromptPayload
  /** Timestamp when prompt was created */
  readonly createdAt: number
  /** Timestamp when prompt will expire */
  readonly timeoutAt: number
  /** Expected button actions from the prompt */
  readonly expectedButtons: readonly string[]
  /** Expected input keys from the prompt */
  readonly expectedInputs: readonly string[]
}

/**
 * Prompt tracker interface
 */
export interface PromptTracker {
  /**
   * Track a new prompt for a socket
   * @returns Result indicating success or failure (e.g., too many prompts)
   */
  readonly track: (socketId: SocketId, payload: PromptPayload) => Result<void>

  /**
   * Validate that a socket owns a specific prompt
   * @returns The tracked prompt if valid, error otherwise
   */
  readonly validate: (socketId: SocketId, promptId: PromptId) => Result<TrackedPrompt>

  /**
   * Remove a prompt after it's been responded to
   */
  readonly remove: (promptId: PromptId) => void

  /**
   * Remove all prompts for a socket (on disconnect)
   */
  readonly removeAllForSocket: (socketId: SocketId) => void

  /**
   * Get count of pending prompts for a socket
   */
  readonly getPendingCount: (socketId: SocketId) => number

  /**
   * Get a tracked prompt by ID (without validation)
   */
  readonly get: (promptId: PromptId) => TrackedPrompt | undefined
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a prompt tracker instance.
 *
 * Uses Map for efficient lookups while maintaining socket -> prompts relationship.
 * Prompts automatically expire based on their timeout.
 */
export function createPromptTracker(): PromptTracker {
  // Primary index: promptId -> TrackedPrompt
  const promptsById = new Map<PromptId, TrackedPrompt>()

  // Secondary index: socketId -> Set<PromptId>
  const promptsBySocket = new Map<SocketId, Set<PromptId>>()

  /**
   * Track a new prompt for a socket
   */
  const track = (socketId: SocketId, payload: PromptPayload): Result<void> => {
    // Check pending limit
    const currentCount = promptsBySocket.get(socketId)?.size ?? 0
    if (currentCount >= PROMPT_LIMITS.MAX_PENDING_PROMPTS_PER_SOCKET) {
      return {
        ok: false,
        error: new Error(`Too many pending prompts (max ${PROMPT_LIMITS.MAX_PENDING_PROMPTS_PER_SOCKET})`)
      }
    }

    const now = Date.now()
    const timeout = payload.timeout ?? PROMPT_TIMEOUTS.DEFAULT_PROMPT_MS

    // Extract expected buttons and inputs
    const expectedButtons = (payload.buttons ?? []).map(b => b.action)
    const expectedInputs = (payload.inputs ?? []).map(i => i.key)

    const tracked: TrackedPrompt = {
      id: payload.id,
      socketId,
      payload,
      createdAt: now,
      timeoutAt: now + timeout,
      expectedButtons,
      expectedInputs
    }

    // Store in primary index
    promptsById.set(payload.id, tracked)

    // Store in secondary index
    let socketPrompts = promptsBySocket.get(socketId)
    if (socketPrompts === undefined) {
      socketPrompts = new Set()
      promptsBySocket.set(socketId, socketPrompts)
    }
    socketPrompts.add(payload.id)

    return { ok: true, value: undefined }
  }

  /**
   * Validate that a socket owns a specific prompt and it hasn't expired
   */
  const validate = (socketId: SocketId, promptId: PromptId): Result<TrackedPrompt> => {
    const tracked = promptsById.get(promptId)

    if (tracked === undefined) {
      return { ok: false, error: new Error('Unknown or already responded prompt ID') }
    }

    if (tracked.socketId !== socketId) {
      return { ok: false, error: new Error('Prompt ID does not belong to this socket') }
    }

    // Check if expired
    if (Date.now() > tracked.timeoutAt) {
      // Clean up expired prompt
      remove(promptId)
      return { ok: false, error: new Error('Prompt has expired') }
    }

    return { ok: true, value: tracked }
  }

  /**
   * Remove a prompt after response
   */
  const remove = (promptId: PromptId): void => {
    const tracked = promptsById.get(promptId)
    if (tracked !== undefined) {
      promptsById.delete(promptId)
      const socketPrompts = promptsBySocket.get(tracked.socketId)
      if (socketPrompts !== undefined) {
        socketPrompts.delete(promptId)
        if (socketPrompts.size === 0) {
          promptsBySocket.delete(tracked.socketId)
        }
      }
    }
  }

  /**
   * Remove all prompts for a socket (cleanup on disconnect)
   */
  const removeAllForSocket = (socketId: SocketId): void => {
    const socketPrompts = promptsBySocket.get(socketId)
    if (socketPrompts !== undefined) {
      for (const promptId of socketPrompts) {
        promptsById.delete(promptId)
      }
      promptsBySocket.delete(socketId)
    }
  }

  /**
   * Get count of pending prompts for a socket
   */
  const getPendingCount = (socketId: SocketId): number => {
    return promptsBySocket.get(socketId)?.size ?? 0
  }

  /**
   * Get a tracked prompt by ID without validation
   */
  const get = (promptId: PromptId): TrackedPrompt | undefined => {
    return promptsById.get(promptId)
  }

  return {
    track,
    validate,
    remove,
    removeAllForSocket,
    getPendingCount,
    get
  }
}
