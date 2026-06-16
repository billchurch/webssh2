// app/security/connect-src.ts
// Pure derivation of CSP connect-src sources from CORS origins.

export interface ConnectSrcResult {
  /** Ordered, de-duplicated CSP source list (always starts with 'self'). */
  readonly sources: string[]
  /** True if any CORS origin was a wildcard (and was therefore dropped). */
  readonly wildcard: boolean
}

/** Concrete `host[:port]` (incl. IPv6 brackets); no whitespace, CR, LF, or junk. */
const HOST_TOKEN_RE = /^[A-Za-z0-9.\-:[\]]+$/

/** Network schemes permitted to pass through verbatim (matched case-insensitively). */
const ALLOWED_SCHEMES = ['http://', 'https://', 'ws://', 'wss://']

function isWildcard(origin: string): boolean {
  return origin.includes('*')
}

function hasScheme(origin: string): boolean {
  return origin.includes('://')
}

function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code <= 0x1f || code === 0x7f) {
      return true
    }
  }
  return false
}

/** True if a scheme-bearing origin uses an allowed network scheme and has no junk. */
function isAllowedSchemeOrigin(origin: string): boolean {
  if (hasControlChars(origin)) {
    return false
  }
  const lower = origin.toLowerCase()
  return ALLOWED_SCHEMES.some((scheme) => lower.startsWith(scheme))
}

/** Expand a concrete `host[:port]` CORS token into valid CSP source expressions. */
function expandHostToken(token: string, secure: boolean): string[] {
  const out = [`https://${token}`, `wss://${token}`]
  if (!secure) {
    out.push(`http://${token}`, `ws://${token}`)
  }
  return out
}

/**
 * Build connect-src from the CORS allowlist plus operator extras.
 *
 * Wildcard tokens in `corsOrigins` are dropped (never derived into CSP) and
 * flagged via `wildcard`. Empty/whitespace and malformed CORS tokens (bad
 * scheme, control chars, non-host junk) are silently dropped. `'self'` covers
 * same-origin.
 *
 * `extras` are operator-controlled (from `csp.connectSrc`) and passed through
 * verbatim, including any intentional CSP wildcards like `*.internal.example`;
 * only empty/whitespace entries are skipped. The `wildcard` flag reflects
 * `corsOrigins` only and is never set by `extras`.
 */
export function deriveConnectSrc(
  corsOrigins: readonly string[],
  extras: readonly string[],
  secure: boolean
): ConnectSrcResult {
  const sources: string[] = ["'self'"]
  let wildcard = false

  for (const origin of corsOrigins) {
    if (origin.trim() === '') {
      continue
    }
    if (isWildcard(origin)) {
      wildcard = true
      continue
    }
    if (hasScheme(origin)) {
      if (isAllowedSchemeOrigin(origin)) {
        sources.push(origin)
      }
    } else if (HOST_TOKEN_RE.test(origin)) {
      sources.push(...expandHostToken(origin, secure))
    }
  }

  for (const extra of extras) {
    if (extra.trim() !== '') {
      sources.push(extra.trim())
    }
  }

  return { sources: [...new Set(sources)], wildcard }
}
