/**
 * Pure parser for the operator-configured Socket.IO transport list (#549).
 *
 * Accepts the config.json forms (string `"polling"` or array
 * `["polling", "websocket"]`) and the env form (comma-separated string).
 * Never throws: malformed input resolves to `undefined` plus a warning
 * string so a bad value can never crash config load or a connection,
 * and the injected field is simply omitted (the client keeps its
 * websocket-first default). Never yields an empty array — with the
 * client's `reconnection: false`, `transports: []` is a socket that can
 * never connect.
 *
 * @pure
 */

const VALID_TRANSPORTS = new Set(['websocket', 'polling'])

export interface TransportParseResult {
  readonly transports: string[] | undefined
  readonly warning: string | undefined
}

function normalize(entries: readonly unknown[]): string[] {
  const cleaned = entries
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => VALID_TRANSPORTS.has(entry))
  return [...new Set(cleaned)]
}

export function parseTransports(raw: unknown): TransportParseResult {
  if (raw === undefined || raw === null) {
    return { transports: undefined, warning: undefined }
  }
  if (typeof raw !== 'string' && !Array.isArray(raw)) {
    return {
      transports: undefined,
      warning: `options.transport: expected string or array, got ${typeof raw}; ignoring`
    }
  }
  const entries = typeof raw === 'string' ? raw.split(',') : raw
  const transports = normalize(entries)
  if (transports.length === 0) {
    return {
      transports: undefined,
      warning:
        'options.transport: no valid transports after filtering (allowed: websocket, polling); using client default'
    }
  }
  return { transports, warning: undefined }
}
