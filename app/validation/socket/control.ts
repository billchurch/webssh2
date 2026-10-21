import type { Result } from '../../types/result.js'
import { VALID_CONTROL_ACTIONS, type ControlAction } from './fields.js'

const isControlAction = (value: string): value is ControlAction =>
  (VALID_CONTROL_ACTIONS as readonly string[]).includes(value)

/**
 * Validate the payload of the `control` socket event: a bare action string.
 * The value is not echoed in errors because it is client-controlled.
 */
export const validateControlMessage = (data: unknown): Result<ControlAction> => {
  if (typeof data !== 'string') {
    return {
      ok: false,
      error: new Error('Control message must be a string')
    }
  }

  if (!isControlAction(data)) {
    return {
      ok: false,
      error: new Error('Unknown control action')
    }
  }

  return { ok: true, value: data }
}
