/**
 * Prompt Handler - Pure Functions
 *
 * Functions for creating prompt payloads with defaults and validation.
 * All functions are pure and return Result types.
 *
 * @module socket/handlers/prompt-handler
 */

import { randomUUID } from 'node:crypto'
import type {
  PromptPayload,
  PromptButton,
  PromptInput
} from '../../types/contracts/v1/socket.js'
import { type PromptId, createPromptId } from '../../types/branded.js'
import {
  PROMPT_TYPES,
  PROMPT_TIMEOUTS,
  PROMPT_SEVERITY,
  PROMPT_BUTTON_VARIANTS,
  type PromptType,
  type PromptSeverityType
} from '../../constants/prompt.js'
import type { Result } from '../../types/result.js'

// =============================================================================
// Input Options Types
// =============================================================================

/**
 * Options for creating an input prompt
 */
export interface InputPromptOptions {
  readonly title: string
  readonly message?: string
  readonly inputs: readonly PromptInput[]
  readonly submitLabel?: string
  readonly cancelLabel?: string
  readonly severity?: PromptSeverityType
  readonly icon?: string
  readonly autoFocus?: boolean
  readonly timeout?: number
}

/**
 * Options for creating a confirmation prompt
 */
export interface ConfirmPromptOptions {
  readonly title: string
  readonly message?: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly severity?: PromptSeverityType
  readonly icon?: string
  readonly timeout?: number
}

/**
 * Options for creating a notice prompt
 */
export interface NoticePromptOptions {
  readonly title: string
  readonly message?: string
  readonly okLabel?: string
  readonly severity?: PromptSeverityType
  readonly icon?: string
  readonly timeout?: number
}

/**
 * Options for creating a toast prompt
 */
export interface ToastPromptOptions {
  readonly title: string
  readonly message?: string
  readonly severity?: PromptSeverityType
  readonly icon?: string
  readonly timeout?: number
}

// =============================================================================
// ID Generation
// =============================================================================

/**
 * Generate a cryptographically secure prompt ID using crypto.randomUUID
 * @pure
 */
export function generatePromptId(): PromptId {
  return createPromptId(randomUUID())
}

// =============================================================================
// Prompt Creators
// =============================================================================

/**
 * Create an input prompt payload
 * @pure
 */
export function createInputPrompt(options: InputPromptOptions): Result<PromptPayload> {
  const id = generatePromptId()

  const buttons: PromptButton[] = [
    {
      action: 'submit',
      label: options.submitLabel ?? 'Submit',
      variant: PROMPT_BUTTON_VARIANTS.PRIMARY
    },
    {
      action: 'cancel',
      label: options.cancelLabel ?? 'Cancel',
      variant: PROMPT_BUTTON_VARIANTS.SECONDARY
    }
  ]

  const payload: PromptPayload = {
    id,
    type: PROMPT_TYPES.INPUT,
    title: options.title,
    ...(options.message === undefined ? {} : { message: options.message }),
    buttons,
    inputs: options.inputs,
    severity: options.severity ?? PROMPT_SEVERITY.INFO,
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    autoFocus: options.autoFocus ?? true,
    timeout: options.timeout ?? PROMPT_TIMEOUTS.DEFAULT_PROMPT_MS,
    closeOnBackdrop: false
  }

  return { ok: true, value: payload }
}

/**
 * Create a confirmation prompt payload
 * @pure
 */
export function createConfirmPrompt(options: ConfirmPromptOptions): Result<PromptPayload> {
  const id = generatePromptId()

  const buttons: PromptButton[] = [
    {
      action: 'confirm',
      label: options.confirmLabel ?? 'Yes',
      variant: PROMPT_BUTTON_VARIANTS.PRIMARY
    },
    {
      action: 'cancel',
      label: options.cancelLabel ?? 'No',
      variant: PROMPT_BUTTON_VARIANTS.SECONDARY
    }
  ]

  const payload: PromptPayload = {
    id,
    type: PROMPT_TYPES.CONFIRM,
    title: options.title,
    ...(options.message === undefined ? {} : { message: options.message }),
    buttons,
    severity: options.severity ?? PROMPT_SEVERITY.INFO,
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    autoFocus: true,
    timeout: options.timeout ?? PROMPT_TIMEOUTS.DEFAULT_PROMPT_MS,
    closeOnBackdrop: true
  }

  return { ok: true, value: payload }
}

/**
 * Create a notice prompt payload
 * @pure
 */
export function createNoticePrompt(options: NoticePromptOptions): Result<PromptPayload> {
  const id = generatePromptId()

  const buttons: PromptButton[] = [
    {
      action: 'ok',
      label: options.okLabel ?? 'OK',
      variant: PROMPT_BUTTON_VARIANTS.PRIMARY
    }
  ]

  const payload: PromptPayload = {
    id,
    type: PROMPT_TYPES.NOTICE,
    title: options.title,
    ...(options.message === undefined ? {} : { message: options.message }),
    buttons,
    severity: options.severity ?? PROMPT_SEVERITY.INFO,
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    autoFocus: true,
    timeout: options.timeout ?? PROMPT_TIMEOUTS.DEFAULT_PROMPT_MS,
    closeOnBackdrop: true
  }

  return { ok: true, value: payload }
}

/**
 * Create a toast prompt payload (fire-and-forget, no response expected)
 * @pure
 */
export function createToastPrompt(options: ToastPromptOptions): Result<PromptPayload> {
  const id = generatePromptId()

  const payload: PromptPayload = {
    id,
    type: PROMPT_TYPES.TOAST,
    title: options.title,
    ...(options.message === undefined ? {} : { message: options.message }),
    severity: options.severity ?? PROMPT_SEVERITY.INFO,
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    autoFocus: false,
    timeout: options.timeout ?? PROMPT_TIMEOUTS.DEFAULT_TOAST_MS,
    closeOnBackdrop: true
  }

  return { ok: true, value: payload }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a custom prompt payload with full control over all fields
 * @pure
 */
export function createCustomPrompt(
  type: PromptType,
  title: string,
  options: {
    readonly message?: string
    readonly buttons?: readonly PromptButton[]
    readonly inputs?: readonly PromptInput[]
    readonly severity?: PromptSeverityType
    readonly icon?: string
    readonly autoFocus?: boolean
    readonly timeout?: number
    readonly closeOnBackdrop?: boolean
  }
): Result<PromptPayload> {
  const id = generatePromptId()

  const payload: PromptPayload = {
    id,
    type,
    title,
    ...(options.message === undefined ? {} : { message: options.message }),
    ...(options.buttons === undefined ? {} : { buttons: options.buttons }),
    ...(options.inputs === undefined ? {} : { inputs: options.inputs }),
    severity: options.severity ?? PROMPT_SEVERITY.INFO,
    ...(options.icon === undefined ? {} : { icon: options.icon }),
    autoFocus: options.autoFocus ?? true,
    timeout: options.timeout ?? PROMPT_TIMEOUTS.DEFAULT_PROMPT_MS,
    closeOnBackdrop: options.closeOnBackdrop ?? true
  }

  return { ok: true, value: payload }
}
