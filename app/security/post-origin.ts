// app/security/post-origin.ts
// Pure CSRF decision for the credential POST routes (#580).
//
// The credential POST routes exist for outside portals that post credentials
// into the gateway, so their requests are cross-site by design and cannot
// carry a per-session token. Protection comes from checking the browser's
// Origin / Sec-Fetch-Site headers against an operator allowlist instead.
// See DOCS/adr/0001-origin-allowlist-for-credential-posts.md.

import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'

/** Longest entry echoed back in a config validation error. */
const MAX_ENTRY_ECHO_LENGTH = 200

const DEFAULT_PORTS: Readonly<Record<string, string>> = {
  'http:': '80',
  'https:': '443'
}

/** Which rule of the decision table produced the result. */
export type PostOriginStep =
  | 'sso-trusted-proxy'
  | 'sso-header'
  | 'same-origin'
  | 'null-origin'
  | 'listed-origin'
  | 'unlisted-origin'
  | 'no-browser-headers'
  | 'unverified-cross-site'

export interface PostOriginDecision {
  readonly accept: boolean
  readonly step: PostOriginStep
}

/** The request facts the decision needs; the adapter extracts them from Express. */
export interface PostOriginRequest {
  readonly origin: string | undefined
  readonly secFetchSite: string | undefined
  readonly clientIp: string | undefined
  readonly hasSsoHeader: boolean
}

export interface PostOriginPolicy {
  /** Normalized origins (see normalizeAllowedPostOrigin). */
  readonly allowedOrigins: readonly string[]
  /** SSO bypasses apply only when SSO is enabled. */
  readonly ssoEnabled: boolean
  readonly trustedProxies: readonly string[]
}

/** Config subset that decides whether the check runs at all. */
export interface PostOriginCheckConfig {
  readonly http: { readonly allowedPostOrigins?: readonly string[] }
  readonly sso: { readonly enabled: boolean; readonly csrfProtection: boolean }
}

function describeEntry(entry: string): string {
  const shown = entry.length > MAX_ENTRY_ECHO_LENGTH
    ? `${entry.slice(0, MAX_ENTRY_ECHO_LENGTH)}...`
    : entry
  // JSON quoting escapes control characters so the entry can't forge log lines
  return JSON.stringify(shown)
}

function parseUrl(value: string): URL | undefined {
  return URL.canParse(value) ? new URL(value) : undefined
}

/**
 * Validate one `http.allowedPostOrigins` entry and return its canonical form
 * (`scheme://host[:port]`, lower case, default port dropped).
 *
 * Accepts only a bare http/https origin, with at most one trailing `/`.
 * Rejects `null`, wildcards, other schemes, credentials, paths, query
 * strings and fragments. The error message names the offending entry.
 */
export function normalizeAllowedPostOrigin(entry: string): Result<string, string> {
  const label = `allowedPostOrigins entry ${describeEntry(entry)}`
  if (entry.toLowerCase() === 'null') {
    return err(`${label} is invalid: "null" origins are never allowed`)
  }
  if (entry.includes('*')) {
    return err(`${label} is invalid: wildcards are not supported`)
  }

  const candidate = entry.endsWith('/') ? entry.slice(0, -1) : entry
  const url = parseUrl(candidate)
  if (url === undefined) {
    return err(`${label} is invalid: not a URL of the form scheme://host[:port]`)
  }

  const defaultPort = DEFAULT_PORTS[url.protocol]
  if (defaultPort === undefined) {
    return err(`${label} is invalid: scheme must be http or https`)
  }

  // Anything that does not round-trip to the bare origin (a path, query,
  // fragment, user info, stray whitespace) is refused rather than trimmed.
  const lowered = candidate.toLowerCase()
  if (lowered !== url.origin && lowered !== `${url.origin}:${defaultPort}`) {
    return err(
      `${label} is invalid: must be a bare origin scheme://host[:port] ` +
      'with no path, query, fragment or credentials'
    )
  }

  return ok(url.origin)
}

/**
 * True when the credential POST routes must run the origin check:
 * an allowlist is configured, or SSO is on with csrfProtection.
 * Otherwise POST behavior is unchanged (no check).
 */
export function isPostOriginCheckActive(config: PostOriginCheckConfig): boolean {
  const allowed = config.http.allowedPostOrigins ?? []
  return allowed.length > 0 || (config.sso.enabled && config.sso.csrfProtection)
}

function isListedOrigin(origin: string, allowedOrigins: readonly string[]): boolean {
  const normalized = normalizeAllowedPostOrigin(origin)
  return normalized.ok && allowedOrigins.includes(normalized.value)
}

function evaluateSsoBypass(
  request: PostOriginRequest,
  policy: PostOriginPolicy
): PostOriginDecision | undefined {
  if (!policy.ssoEnabled) {
    return undefined
  }
  // A trusted SSO proxy forwards the user's POST server-side; it has already
  // authenticated the user, so its requests are not browser CSRF.
  if (request.clientIp !== undefined && policy.trustedProxies.includes(request.clientIp)) {
    return { accept: true, step: 'sso-trusted-proxy' }
  }
  // A cross-site HTML form cannot set custom headers, and fetch() cannot
  // without passing a CORS preflight, so these headers prove a non-CSRF caller.
  if (request.hasSsoHeader) {
    return { accept: true, step: 'sso-header' }
  }
  return undefined
}

/**
 * Decide whether a credential POST may proceed. Call only when
 * isPostOriginCheckActive() is true. Rules run in the order of the decision
 * table in SECURITY.md; the first match wins.
 */
export function evaluatePostOrigin(
  request: PostOriginRequest,
  policy: PostOriginPolicy
): PostOriginDecision {
  const bypass = evaluateSsoBypass(request, policy)
  if (bypass !== undefined) {
    return bypass
  }

  const secFetchSite = request.secFetchSite?.toLowerCase()

  // Step 1: the browser itself says the form came from this gateway's origin.
  // Same-origin is read only from Sec-Fetch-Site: comparing Origin with Host
  // gives the wrong answer behind a TLS-terminating proxy.
  if (secFetchSite === 'same-origin') {
    return { accept: true, step: 'same-origin' }
  }

  if (request.origin !== undefined) {
    // Step 2a: browsers send "null" from sandboxed frames, data: URLs and
    // some redirects. It names no site, so it can never be trusted.
    if (request.origin.trim().toLowerCase() === 'null') {
      return { accept: false, step: 'null-origin' }
    }
    // Step 2b: an operator-listed portal.
    if (isListedOrigin(request.origin, policy.allowedOrigins)) {
      return { accept: true, step: 'listed-origin' }
    }
    // Step 2c: any other site.
    return { accept: false, step: 'unlisted-origin' }
  }

  // Step 3: every current browser sends Origin on a cross-site POST, so a
  // request with neither header is not browser-driven (curl, scripts,
  // server-to-server) and cannot carry a victim's cookies.
  if (secFetchSite === undefined) {
    return { accept: true, step: 'no-browser-headers' }
  }

  // Step 4: a browser request (same-site, cross-site or none) with no Origin
  // we can verify.
  return { accept: false, step: 'unverified-cross-site' }
}
