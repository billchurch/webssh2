import type { Result } from '../../types/result.js'
import {
  ensureRecord,
  validateStringField
} from './helpers.js'
import { ACTION_FIELD, VALID_CONTROL_ACTIONS } from './fields.js'

export const validateControlMessage = (data: unknown): Result<{ action: string }> => {
  const recordResult = ensureRecord(data, 'Control data must be an object')
  if (!recordResult.ok) {
    return recordResult as Result<{ action: string }>
  }

  const control = recordResult.value
  const actionResult = validateStringField(control, ACTION_FIELD, {
    required: true,
    errorMessage: 'Action is required and must be a non-empty string',
    trim: true
  })
  if (!actionResult.ok) {
    return actionResult as Result<{ action: string }>
  }

  const action = (actionResult.value as string).toLowerCase()
  if (!VALID_CONTROL_ACTIONS.has(action)) {
    return {
      ok: false,
      error: new Error(`Unknown control action: ${action}`)
    }
  }

  return { ok: true, value: { action } }
}
