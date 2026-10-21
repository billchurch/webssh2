import type { Result } from '../../types/result.js'

/**
 * Validate the payload of the `data` socket event (terminal keystrokes).
 * Size is bounded by the Socket.IO transport (`maxHttpBufferSize`).
 */
export const validateDataMessage = (data: unknown): Result<string | Buffer> => {
  if (typeof data === 'string' || Buffer.isBuffer(data)) {
    return { ok: true, value: data }
  }

  return {
    ok: false,
    error: new Error('Terminal data must be a string or Buffer')
  }
}
