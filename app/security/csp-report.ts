// app/security/csp-report.ts
// Pure, defensive extraction of a CSP violation report into a whitelisted,
// length-bounded, control-char-stripped shape safe for structured logging.
// The report body is attacker-controlled (unauthenticated endpoint), so we
// extract ONLY known fields, truncate them, and strip CR/LF/control chars to
// prevent log forging and log flooding.

export interface ExtractedCspReport {
  directive?: string
  blockedUri?: string
  disposition?: string
  documentUri?: string
  scriptSample?: string
}

const MAX_URI = 512
const MAX_SAMPLE = 80
const MAX_DISPOSITION = 32

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Strip control chars (incl. CR/LF) and truncate. Returns undefined for non-strings. */
function sanitize(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  let stripped = ''
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x20 && code !== 0x7f) {
      stripped += ch
    }
  }
  return stripped.slice(0, max)
}

function pickRaw(body: Record<string, unknown>): Record<string, unknown> {
  if (isObject(body['csp-report'])) {
    return body['csp-report']
  }
  if (isObject(body['body'])) {
    return body['body']
  }
  return body
}

/**
 * Accepts a legacy `{ "csp-report": {...} }` body, a Reporting-API
 * `{ body: {...} }` shape, or a flat object, and returns whitelisted,
 * sanitized fields. Never throws; returns `{}` for non-object input.
 */
export function extractCspReport(body: unknown): ExtractedCspReport {
  if (!isObject(body)) {
    return {}
  }
  const raw = pickRaw(body)
  const result: ExtractedCspReport = {}
  const directive = sanitize(raw['violated-directive'] ?? raw['effectiveDirective'], MAX_URI)
  const blockedUri = sanitize(raw['blocked-uri'] ?? raw['blockedURL'], MAX_URI)
  const disposition = sanitize(raw['disposition'], MAX_DISPOSITION)
  const documentUri = sanitize(raw['document-uri'] ?? raw['documentURL'], MAX_URI)
  const scriptSample = sanitize(raw['script-sample'] ?? raw['sample'], MAX_SAMPLE)
  if (directive !== undefined) {
    result.directive = directive
  }
  if (blockedUri !== undefined) {
    result.blockedUri = blockedUri
  }
  if (disposition !== undefined) {
    result.disposition = disposition
  }
  if (documentUri !== undefined) {
    result.documentUri = documentUri
  }
  if (scriptSample !== undefined) {
    result.scriptSample = scriptSample
  }
  return result
}
