// server
// app/validators/exec-validate.ts
// Lightweight runtime validation for exec payloads (no external deps)
import { isValidEnvKey, isValidEnvValue } from '../utils.js'

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
      const arr = p['env'] as unknown[]
      const entries = arr.slice(0, 50).map((v, i) => [String(i), String(v)] as [string, string])
      out.env = Object.fromEntries(entries)
    } else if (typeof p['env'] === 'object') {
      const src = p['env'] as Record<string, unknown>
      const entries = Object.entries(src)
        .filter(
          ([k, v]) =>
            typeof k === 'string' && isValidEnvKey(k) && v != null && isValidEnvValue(String(v))
        )
        .slice(0, 50)
        .map(([k, v]) => [k, String(v)] as [string, string])
      out.env = Object.fromEntries(entries)
    } else {
      out.env = {}
    }
  }
  if (p['timeoutMs'] != null) {
    out.timeoutMs = Number(p['timeoutMs'])
  }
  return out
}
