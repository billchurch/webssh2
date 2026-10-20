// app/config/trust-proxy.ts
// Parsing and validation for http.trustProxy (Express `trust proxy` setting)

import { isIP } from 'node:net'
import type { TrustProxySetting } from '../types/config.js'
import { parseArrayValue } from './env-parser.js'

/** Named address ranges Express (proxy-addr) accepts in a trust list */
const NAMED_RANGES: ReadonlySet<string> = new Set(['loopback', 'linklocal', 'uniquelocal'])

const DECIMAL_DIGITS = /^\d+$/

/**
 * Whether a trustProxy value turns proxy trust on. `false`, `0` and an empty
 * list all mean "trust nothing", which is Express's default, so they are
 * treated as unset and the app keeps its direct-connection behavior.
 * @pure
 */
export function isTrustProxyEnabled(setting: TrustProxySetting | undefined): boolean {
  if (setting === undefined) {
    return false
  }
  if (typeof setting === 'boolean') {
    return setting
  }
  if (typeof setting === 'number') {
    return setting > 0
  }
  return setting.length > 0
}

/**
 * Check one trust-list entry: an IPv4/IPv6 address, a CIDR range with a
 * prefix length valid for its address family, or a named range. The prefix
 * must be at least 1: Express (proxy-addr) rejects /0 at startup.
 * @pure
 */
export function isValidTrustProxyEntry(entry: string): boolean {
  if (NAMED_RANGES.has(entry)) {
    return true
  }

  const slash = entry.indexOf('/')
  if (slash === -1) {
    return isIP(entry) !== 0
  }

  const family = isIP(entry.slice(0, slash))
  const prefix = entry.slice(slash + 1)
  if (family === 0 || !DECIMAL_DIGITS.test(prefix)) {
    return false
  }
  const maxPrefix = family === 4 ? 32 : 128
  const length = Number.parseInt(prefix, 10)
  return length >= 1 && length <= maxPrefix
}

/**
 * Parse WEBSSH2_HTTP_TRUST_PROXY. `true`/`false` become booleans, a plain
 * integer becomes a hop count, and anything else is read as a comma-separated
 * (or JSON array) list of addresses. The result is checked by the config
 * schema, so a malformed value fails validation instead of being dropped.
 * Returns undefined for an empty value.
 * @pure
 */
export function parseTrustProxyEnv(raw: string): TrustProxySetting | undefined {
  const value = raw.trim()
  if (value === '') {
    return undefined
  }

  const lower = value.toLowerCase()
  if (lower === 'true') {
    return true
  }
  if (lower === 'false') {
    return false
  }
  if (DECIMAL_DIGITS.test(value)) {
    return Number.parseInt(value, 10)
  }
  return parseArrayValue(value)
}
