// app/config/auth-method-parser.ts
// Pure parser for resolving allowed SSH authentication methods from configuration

import { AUTH_METHOD_TOKENS, DEFAULT_AUTH_METHODS } from '../constants/index.js'
import { createAuthMethod, type AuthMethod, type AuthMethodToken } from '../types/branded.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/index.js'

export interface AuthMethodParserWarning {
  readonly type: 'unknown-token'
  readonly token: string
}

export interface AuthMethodParserError {
  readonly type: 'empty-allow-list'
  readonly message: string
}

export interface ResolveAuthMethodsInput {
  readonly rawValues?: readonly string[]
  readonly defaultMethods?: readonly AuthMethodToken[]
}

export interface ResolvedAuthMethods {
  readonly methods: readonly AuthMethod[]
  readonly warnings: readonly AuthMethodParserWarning[]
}

const KNOWN_TOKENS = new Set<AuthMethodToken>(Object.values(AUTH_METHOD_TOKENS))

function isKnownToken(value: string): value is AuthMethodToken {
  return KNOWN_TOKENS.has(value as AuthMethodToken)
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Resolve allowed SSH authentication methods from raw configuration values.
 *
 * @param input - Raw configuration tokens and optional defaults
 * @returns Result containing branded auth methods and any parser warnings
 * @pure
 */
export function resolveAllowedAuthMethods(
  input: ResolveAuthMethodsInput = {}
): Result<ResolvedAuthMethods, AuthMethodParserError> {
  const fallback = input.defaultMethods ?? DEFAULT_AUTH_METHODS
  const rawCandidates = input.rawValues ?? fallback

  const resolved: AuthMethod[] = []
  const warnings: AuthMethodParserWarning[] = []
  const seenTokens = new Set<AuthMethodToken>()
  const warnedTokens = new Set<string>()

  for (const rawToken of rawCandidates) {
    const normalized = normalizeToken(rawToken)
    if (!isKnownToken(normalized)) {
      if (!warnedTokens.has(normalized) && normalized !== '') {
        warnedTokens.add(normalized)
        warnings.push({
          type: 'unknown-token',
          token: normalized,
        })
      }
      continue
    }

    if (seenTokens.has(normalized)) {
      continue
    }

    seenTokens.add(normalized)
    resolved.push(createAuthMethod(normalized))
  }

  if (resolved.length === 0) {
    return err({
      type: 'empty-allow-list',
      message: 'Allowed authentication methods list cannot be empty after validation',
    })
  }

  return ok({
    methods: resolved,
    warnings,
  })
}
