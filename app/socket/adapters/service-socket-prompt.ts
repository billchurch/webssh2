/**
 * Prompt Socket Adapter
 *
 * Handles prompt socket events and provides helper methods for
 * sending prompts to clients with Socket.IO acknowledgements.
 *
 * @module socket/adapters/service-socket-prompt
 */

import type { AdapterContext } from './service-socket-shared.js'
import type {
  PromptPayload,
  PromptResponsePayload,
  PromptAck
} from '../../types/contracts/v1/socket.js'
import { type PromptId, createSocketId } from '../../types/branded.js'
import { SOCKET_EVENTS } from '../../constants/socket-events.js'
import {
  createInputPrompt,
  createConfirmPrompt,
  createNoticePrompt,
  createToastPrompt,
  type InputPromptOptions,
  type ConfirmPromptOptions,
  type NoticePromptOptions,
  type ToastPromptOptions
} from '../handlers/prompt-handler.js'
import {
  validatePromptResponse,
  validateResponseAction,
  validateResponseInputKeys
} from '../handlers/prompt-validator.js'
import {
  createPromptTracker,
  type PromptTracker,
  type TrackedPrompt
} from '../handlers/prompt-tracker.js'
import { emitSocketLog } from '../../logging/socket-logger.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Handler function called when a prompt receives a response
 */
export type PromptResponseHandler = (
  response: PromptResponsePayload,
  tracked: TrackedPrompt
) => void | Promise<void>

// =============================================================================
// Prompt Socket Adapter
// =============================================================================

/**
 * Prompt Socket Adapter
 *
 * Responsible for:
 * - Sending prompts to clients with acknowledgement
 * - Tracking pending prompts per socket
 * - Validating prompt responses
 * - Calling registered response handlers
 */
export class ServiceSocketPrompt {
  private readonly tracker: PromptTracker
  private readonly responseHandlers: Map<PromptId, PromptResponseHandler>

  constructor(private readonly context: AdapterContext) {
    this.tracker = createPromptTracker()
    this.responseHandlers = new Map()
  }

  // ===========================================================================
  // Response Handler
  // ===========================================================================

  /**
   * Handle prompt-response event from client
   */
  async handlePromptResponse(data: unknown): Promise<void> {
    const socketId = createSocketId(this.context.socket.id)

    // Validate the response payload format
    const validationResult = validatePromptResponse(data)
    if (!validationResult.ok) {
      this.context.debug('Invalid prompt response:', validationResult.error.message)
      this.logPromptEvent('prompt_error', 'warn', {
        error: validationResult.error.message,
        reason: 'invalid_response_format'
      })
      return
    }

    const response = validationResult.value

    // Validate socket owns this prompt
    const trackResult = this.tracker.validate(socketId, response.id)
    if (!trackResult.ok) {
      this.context.debug('Prompt validation failed:', trackResult.error.message)
      this.logPromptEvent('prompt_error', 'warn', {
        promptId: response.id,
        error: trackResult.error.message,
        reason: 'unauthorized_response'
      })
      return
    }

    const tracked = trackResult.value

    // Validate action matches expected buttons (if buttons exist)
    if (tracked.payload.buttons !== undefined && tracked.payload.buttons.length > 0) {
      const actionResult = validateResponseAction(response.action, tracked.payload.buttons)
      if (!actionResult.ok) {
        this.context.debug('Invalid action:', actionResult.error.message)
        this.logPromptEvent('prompt_error', 'warn', {
          promptId: response.id,
          action: response.action,
          error: actionResult.error.message,
          reason: 'invalid_action'
        })
        return
      }
    }

    // Validate input keys match expected inputs
    const inputsResult = validateResponseInputKeys(response.inputs, tracked.payload.inputs)
    if (!inputsResult.ok) {
      this.context.debug('Invalid inputs:', inputsResult.error.message)
      this.logPromptEvent('prompt_error', 'warn', {
        promptId: response.id,
        error: inputsResult.error.message,
        reason: 'invalid_inputs'
      })
      return
    }

    // Remove from tracker (prompt is now handled)
    this.tracker.remove(response.id)

    // Call registered handler
    const handler = this.responseHandlers.get(response.id)
    if (handler === undefined) {
      // No handler registered (might be toast or already handled)
      this.logPromptEvent('prompt_response', 'info', {
        promptId: response.id,
        type: tracked.payload.type,
        action: response.action,
        note: 'no_handler_registered'
      })
    } else {
      this.responseHandlers.delete(response.id)
      try {
        await handler(response, tracked)
        this.logPromptEvent('prompt_response', 'info', {
          promptId: response.id,
          type: tracked.payload.type,
          action: response.action
        })
      } catch (error) {
        this.context.debug('Prompt handler error:', error)
        this.logPromptEvent('prompt_error', 'error', {
          promptId: response.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          reason: 'handler_error'
        })
      }
    }
  }

  // ===========================================================================
  // Prompt Senders
  // ===========================================================================

  /**
   * Send an input prompt (for collecting text/password input)
   *
   * @param options - Input prompt configuration
   * @param onResponse - Handler called when user responds
   * @returns The prompt ID if sent successfully, null otherwise
   */
  sendInputPrompt(
    options: InputPromptOptions,
    onResponse: PromptResponseHandler
  ): PromptId | null {
    const result = createInputPrompt(options)
    if (!result.ok) {
      this.context.debug('Failed to create input prompt:', result.error)
      return null
    }
    return this.sendPrompt(result.value, onResponse)
  }

  /**
   * Send a confirmation prompt (yes/no/cancel)
   *
   * @param options - Confirm prompt configuration
   * @param onResponse - Handler called when user responds
   * @returns The prompt ID if sent successfully, null otherwise
   */
  sendConfirmPrompt(
    options: ConfirmPromptOptions,
    onResponse: PromptResponseHandler
  ): PromptId | null {
    const result = createConfirmPrompt(options)
    if (!result.ok) {
      this.context.debug('Failed to create confirm prompt:', result.error)
      return null
    }
    return this.sendPrompt(result.value, onResponse)
  }

  /**
   * Send a notice prompt (information with OK button)
   *
   * @param options - Notice prompt configuration
   * @param onResponse - Handler called when user responds
   * @returns The prompt ID if sent successfully, null otherwise
   */
  sendNoticePrompt(
    options: NoticePromptOptions,
    onResponse: PromptResponseHandler
  ): PromptId | null {
    const result = createNoticePrompt(options)
    if (!result.ok) {
      this.context.debug('Failed to create notice prompt:', result.error)
      return null
    }
    return this.sendPrompt(result.value, onResponse)
  }

  /**
   * Send a toast prompt (fire-and-forget, no response expected)
   *
   * @param options - Toast prompt configuration
   * @returns The prompt ID if sent successfully, null otherwise
   */
  sendToastPrompt(options: ToastPromptOptions): PromptId | null {
    const result = createToastPrompt(options)
    if (!result.ok) {
      this.context.debug('Failed to create toast prompt:', result.error)
      return null
    }

    // Toasts don't need tracking or response handlers - fire and forget
    this.context.socket.emit(SOCKET_EVENTS.PROMPT, result.value)
    this.logPromptEvent('prompt_sent', 'info', {
      promptId: result.value.id,
      type: 'toast',
      title: result.value.title
    })
    return result.value.id
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Cleanup on socket disconnect
   */
  handleDisconnect(): void {
    const socketId = createSocketId(this.context.socket.id)

    // Log any pending prompts that were abandoned
    const pendingCount = this.tracker.getPendingCount(socketId)
    if (pendingCount > 0) {
      this.context.debug(`Cleaning up ${pendingCount} pending prompts on disconnect`)
    }

    // Remove all prompts for this socket
    this.tracker.removeAllForSocket(socketId)

    // Clear all response handlers
    this.responseHandlers.clear()
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get the number of pending prompts for this socket
   */
  getPendingCount(): number {
    const socketId = createSocketId(this.context.socket.id)
    return this.tracker.getPendingCount(socketId)
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Send a prompt with tracking and acknowledgement
   */
  private sendPrompt(
    payload: PromptPayload,
    onResponse: PromptResponseHandler
  ): PromptId | null {
    const socketId = createSocketId(this.context.socket.id)

    // Track the prompt
    const trackResult = this.tracker.track(socketId, payload)
    if (!trackResult.ok) {
      this.context.debug('Failed to track prompt:', trackResult.error.message)
      this.logPromptEvent('prompt_error', 'warn', {
        promptId: payload.id,
        error: trackResult.error.message,
        reason: 'tracking_failed'
      })
      return null
    }

    // Register response handler
    this.responseHandlers.set(payload.id, onResponse)

    // Send with Socket.IO acknowledgement callback
    this.context.socket.emit(
      SOCKET_EVENTS.PROMPT,
      payload,
      (_ack: PromptAck) => {
        // Callback being called indicates client received the prompt
        this.context.debug(`Prompt ${payload.id} acknowledged by client`)
      }
    )

    this.logPromptEvent('prompt_sent', 'info', {
      promptId: payload.id,
      type: payload.type,
      title: payload.title
    })

    return payload.id
  }

  /**
   * Log a prompt event
   */
  private logPromptEvent(
    event: 'prompt_sent' | 'prompt_response' | 'prompt_timeout' | 'prompt_error',
    level: 'info' | 'warn' | 'error',
    data: Record<string, unknown>
  ): void {
    emitSocketLog(this.context, level, event, `Prompt ${event}`, {
      subsystem: 'prompt',
      data
    })
  }
}
