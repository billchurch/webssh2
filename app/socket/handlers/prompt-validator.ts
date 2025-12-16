/**
 * Prompt Validator - Pure Functions
 *
 * Validates prompt payloads and responses from clients.
 * Uses pure functions that return Result types for type-safe validation.
 *
 * @module socket/handlers/prompt-validator
 */

import type { Result } from '../../types/result.js'
import type {
  PromptResponsePayload,
  PromptButton,
  PromptInput
} from '../../types/contracts/v1/socket.js'
import { type PromptId, createPromptId, isPromptId } from '../../types/branded.js'
import { createSafeKey, safeGet, isRecord } from '../../utils/safe-property-access.js'
import {
  PROMPT_LIMITS,
  PROMPT_PATTERNS,
  ALLOWED_PROMPT_ICONS
} from '../../constants/prompt.js'

// =============================================================================
// Safe Keys for Property Access
// =============================================================================

const ID_KEY = createSafeKey('id')
const ACTION_KEY = createSafeKey('action')
const INPUTS_KEY = createSafeKey('inputs')

// =============================================================================
// Response Validation
// =============================================================================

/**
 * Validate prompt response from client
 * @pure
 */
export function validatePromptResponse(
  data: unknown
): Result<PromptResponsePayload> {
  // Ensure data is a record
  if (!isRecord(data)) {
    return { ok: false, error: new Error('Prompt response must be an object') }
  }

  // Validate id
  const id = safeGet(data, ID_KEY)
  if (!isPromptId(id)) {
    return { ok: false, error: new Error('Invalid or missing prompt ID') }
  }

  // Validate action
  const actionResult = validateAction(safeGet(data, ACTION_KEY))
  if (!actionResult.ok) {
    return actionResult
  }

  // Validate optional inputs
  const inputs = safeGet(data, INPUTS_KEY)
  if (inputs !== undefined && inputs !== null) {
    const inputsResult = validateResponseInputs(inputs)
    if (!inputsResult.ok) {
      return { ok: false, error: inputsResult.error }
    }
    return {
      ok: true,
      value: {
        id: createPromptId(id),
        action: actionResult.value,
        inputs: inputsResult.value
      }
    }
  }

  return {
    ok: true,
    value: {
      id: createPromptId(id),
      action: actionResult.value
    }
  }
}

/**
 * Validate action string
 * @pure
 */
function validateAction(value: unknown): Result<string> {
  if (typeof value !== 'string') {
    return { ok: false, error: new Error('Action must be a string') }
  }

  if (value.length === 0) {
    return { ok: false, error: new Error('Action is required') }
  }

  if (value.length > PROMPT_LIMITS.MAX_ACTION_LENGTH) {
    return { ok: false, error: new Error(`Action exceeds maximum length of ${PROMPT_LIMITS.MAX_ACTION_LENGTH}`) }
  }

  if (!PROMPT_PATTERNS.ACTION_NAME.test(value)) {
    return { ok: false, error: new Error('Invalid action format: must start with letter, contain only alphanumeric, underscore, hyphen') }
  }

  return { ok: true, value }
}

/**
 * Validate input values in response
 * @pure
 */
function validateResponseInputs(
  inputs: unknown
): Result<Record<string, string>> {
  if (!isRecord(inputs)) {
    return { ok: false, error: new Error('Inputs must be an object') }
  }

  const entries = Object.entries(inputs)
  if (entries.length > PROMPT_LIMITS.MAX_INPUTS) {
    return { ok: false, error: new Error(`Too many input values (max ${PROMPT_LIMITS.MAX_INPUTS})`) }
  }

  const validatedInputs: Record<string, string> = {}

  for (const [key, value] of entries) {
    // Validate key format
    if (!PROMPT_PATTERNS.INPUT_KEY.test(key)) {
      return { ok: false, error: new Error(`Invalid input key format: ${key}`) }
    }

    // Validate value is string
    if (typeof value !== 'string') {
      return { ok: false, error: new Error(`Input value for '${key}' must be a string`) }
    }

    // Validate value length
    if (value.length > PROMPT_LIMITS.MAX_INPUT_VALUE_LENGTH) {
      return { ok: false, error: new Error(`Input value for '${key}' exceeds maximum length of ${PROMPT_LIMITS.MAX_INPUT_VALUE_LENGTH}`) }
    }

    // Check for HTML injection (basic prevention)
    if (PROMPT_PATTERNS.HTML_TAG.test(value)) {
      return { ok: false, error: new Error(`Input value for '${key}' contains invalid HTML-like content`) }
    }

    // Key has been validated against INPUT_KEY pattern above, so this is safe
    // eslint-disable-next-line security/detect-object-injection
    validatedInputs[key] = value
  }

  return { ok: true, value: validatedInputs }
}

// =============================================================================
// Response Action Validation
// =============================================================================

/**
 * Validate that a response action matches one of the expected button actions
 * @pure
 */
export function validateResponseAction(
  action: string,
  expectedButtons: readonly PromptButton[]
): Result<void> {
  // Build set of valid actions from buttons
  const validActions = new Set(expectedButtons.map(b => b.action))

  // Also allow special actions
  validActions.add('dismissed')
  validActions.add('timeout')

  if (!validActions.has(action)) {
    const allowed = Array.from(validActions).join(', ')
    return { ok: false, error: new Error(`Invalid action '${action}'. Expected one of: ${allowed}`) }
  }

  return { ok: true, value: undefined }
}

// =============================================================================
// Response Input Keys Validation
// =============================================================================

/**
 * Validate that response input keys match expected inputs
 * @pure
 */
export function validateResponseInputKeys(
  responseInputs: Record<string, string> | undefined,
  expectedInputs: readonly PromptInput[] | undefined
): Result<void> {
  // No inputs expected
  if (expectedInputs === undefined || expectedInputs.length === 0) {
    if (responseInputs !== undefined && Object.keys(responseInputs).length > 0) {
      return { ok: false, error: new Error('Unexpected input values provided') }
    }
    return { ok: true, value: undefined }
  }

  // Build expected keys set
  const expectedKeys = new Set(expectedInputs.map(i => i.key))
  const requiredKeys = new Set(
    expectedInputs.filter(i => i.required === true).map(i => i.key)
  )

  // No inputs provided
  if (responseInputs === undefined) {
    if (requiredKeys.size > 0) {
      const missing = Array.from(requiredKeys).join(', ')
      return { ok: false, error: new Error(`Missing required inputs: ${missing}`) }
    }
    return { ok: true, value: undefined }
  }

  // Check all provided keys are expected
  for (const key of Object.keys(responseInputs)) {
    if (!expectedKeys.has(key)) {
      return { ok: false, error: new Error(`Unexpected input key: ${key}`) }
    }
  }

  // Check all required keys are provided with non-empty values
  for (const key of requiredKeys) {
    // Key comes from expectedInputs which are controlled by server, so this is safe
    // eslint-disable-next-line security/detect-object-injection
    const value = responseInputs[key]
    if (value === undefined || value === '') {
      return { ok: false, error: new Error(`Missing or empty required input: ${key}`) }
    }
  }

  return { ok: true, value: undefined }
}

// =============================================================================
// Icon Validation
// =============================================================================

/**
 * Validate icon name against whitelist
 * @pure
 */
export function validateIcon(icon: string | undefined): Result<string | undefined> {
  if (icon === undefined) {
    return { ok: true, value: undefined }
  }

  if (typeof icon !== 'string') {
    return { ok: false, error: new Error('Icon must be a string') }
  }

  if (icon.length > PROMPT_LIMITS.MAX_ICON_LENGTH) {
    return { ok: false, error: new Error(`Icon name exceeds maximum length of ${PROMPT_LIMITS.MAX_ICON_LENGTH}`) }
  }

  if (!ALLOWED_PROMPT_ICONS.has(icon)) {
    return { ok: false, error: new Error(`Invalid icon '${icon}': not in allowed icon list`) }
  }

  return { ok: true, value: icon }
}

// =============================================================================
// Title and Message Validation
// =============================================================================

/**
 * Validate prompt title
 * @pure
 */
export function validateTitle(title: unknown): Result<string> {
  if (typeof title !== 'string') {
    return { ok: false, error: new Error('Title must be a string') }
  }

  if (title.length === 0) {
    return { ok: false, error: new Error('Title is required') }
  }

  if (title.length > PROMPT_LIMITS.MAX_TITLE_LENGTH) {
    return { ok: false, error: new Error(`Title exceeds maximum length of ${PROMPT_LIMITS.MAX_TITLE_LENGTH}`) }
  }

  if (PROMPT_PATTERNS.HTML_TAG.test(title)) {
    return { ok: false, error: new Error('Title contains invalid HTML-like content') }
  }

  return { ok: true, value: title }
}

/**
 * Validate prompt message
 * @pure
 */
export function validateMessage(message: unknown): Result<string | undefined> {
  if (message === undefined || message === null) {
    return { ok: true, value: undefined }
  }

  if (typeof message !== 'string') {
    return { ok: false, error: new Error('Message must be a string') }
  }

  if (message.length > PROMPT_LIMITS.MAX_MESSAGE_LENGTH) {
    return { ok: false, error: new Error(`Message exceeds maximum length of ${PROMPT_LIMITS.MAX_MESSAGE_LENGTH}`) }
  }

  if (PROMPT_PATTERNS.HTML_TAG.test(message)) {
    return { ok: false, error: new Error('Message contains invalid HTML-like content') }
  }

  return { ok: true, value: message }
}

// =============================================================================
// Prompt ID Validation
// =============================================================================

/**
 * Validate prompt ID format (UUID v4)
 * @pure
 */
export function validatePromptId(id: unknown): Result<PromptId> {
  if (typeof id !== 'string') {
    return { ok: false, error: new Error('Prompt ID must be a string') }
  }

  if (!PROMPT_PATTERNS.UUID_V4.test(id)) {
    return { ok: false, error: new Error('Prompt ID must be a valid UUID v4') }
  }

  return { ok: true, value: createPromptId(id) }
}
