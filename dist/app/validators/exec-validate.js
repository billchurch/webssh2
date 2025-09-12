// server
// app/validators/exec-validate.js
// Lightweight runtime validation for exec payloads (no external deps)

/**
 * Validate and normalize exec payload
 * @param {unknown} payload
 * @returns {{ command: string, pty?: boolean, term?: string, cols?: number, rows?: number, env?: Record<string,string>, timeoutMs?: number }}
 */
export function validateExecPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload must be an object')
  }
  const p = /** @type {any} */ (payload)
  if (typeof p.command !== 'string' || !p.command.trim()) {
    throw new Error('command must be a non-empty string')
  }
  const out = { command: String(p.command).trim() }
  if (p.pty != null) {
    out.pty = !!p.pty
  }
  if (p.term != null) {
    out.term = String(p.term)
  }
  if (p.cols != null) {
    out.cols = Number(p.cols)
  }
  if (p.rows != null) {
    out.rows = Number(p.rows)
  }
  if (p.env != null) {
    if (Array.isArray(p.env)) {
      const obj = {}
      for (let i = 0; i < p.env.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        obj[i] = String(p.env[i])
      }
      out.env = obj
    } else if (typeof p.env === 'object') {
      const obj = {}
      for (const [k, v] of Object.entries(p.env)) {
        obj[String(k)] = String(v)
      }
      out.env = obj
    } else {
      out.env = {}
    }
  }
  if (p.timeoutMs != null) {
    out.timeoutMs = Number(p.timeoutMs)
  }
  return out
}
