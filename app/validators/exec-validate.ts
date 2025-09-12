// server
// app/validators/exec-validate.ts
// Lightweight runtime validation for exec payloads (no external deps)

export interface ExecValidated {
  command: string
  pty?: boolean
  term?: string
  cols?: number
  rows?: number
  env?: Record<string, string>
  timeoutMs?: number
}

export function validateExecPayload(payload: unknown): ExecValidated {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload must be an object')
  }
  const p = payload as Record<string, unknown>
  if (typeof p['command'] !== 'string' || !String(p['command']).trim()) {
    throw new Error('command must be a non-empty string')
  }
  const out: ExecValidated = { command: String(p['command']).trim() }
  if (p['pty'] != null) {
    out.pty = Boolean(p['pty'])
  }
  if (p['term'] != null) {
    out.term = String(p['term'])
  }
  if (p['cols'] != null) {
    out.cols = Number(p['cols'])
  }
  if (p['rows'] != null) {
    out.rows = Number(p['rows'])
  }
  if (p['env'] != null) {
    if (Array.isArray(p['env'])) {
      const obj: Record<string, string> = {}
      for (let i = 0; i < (p['env'] as unknown[]).length; i++) {
        obj[String(i)] = String((p['env'] as unknown[])[i])
      }
      out.env = obj
    } else if (typeof p['env'] === 'object') {
      const src = p['env'] as Record<string, unknown>
      const obj: Record<string, string> = {}
      for (const k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) {
          obj[String(k)] = String(src[k] as unknown)
        }
      }
      out.env = obj
    } else {
      out.env = {}
    }
  }
  if (p['timeoutMs'] != null) {
    out.timeoutMs = Number(p['timeoutMs'])
  }
  return out
}
