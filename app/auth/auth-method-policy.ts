// app/auth/auth-method-policy.ts
// Pure helpers for enforcing SSH authentication method policy

import type { AuthMethod, AuthMethodToken } from '../types/branded.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/index.js'

export interface AuthMethodPolicyContext {
  readonly password?: string | null | undefined
  readonly privateKey?: string | null | undefined
  readonly requestedKeyboardInteractive?: boolean
}

export interface AuthMethodPolicyEvaluation {
  readonly requested: readonly AuthMethodToken[]
}

export interface AuthMethodPolicyViolation {
  readonly error: 'auth_method_disabled'
  readonly method: AuthMethodToken
}

export function evaluateAuthMethodPolicy(
  allowed: readonly AuthMethod[],
  context: AuthMethodPolicyContext
): Result<AuthMethodPolicyEvaluation, AuthMethodPolicyViolation> {
  const requested = resolveRequestedAuthMethods(context)
  if (requested.length === 0) {
    return ok({ requested })
  }

  const allowedMethods = new Set<AuthMethodToken>(allowed.map(toToken))

  for (const method of requested) {
    if (!allowedMethods.has(method)) {
      return err({
        error: 'auth_method_disabled',
        method
      })
    }
  }

  return ok({ requested })
}

export function isAuthMethodAllowed(
  allowed: readonly AuthMethod[],
  method: AuthMethodToken
): boolean {
  return allowed.some((allowedMethod) => toToken(allowedMethod) === method)
}

export function resolveRequestedAuthMethods(
  context: AuthMethodPolicyContext
): AuthMethodToken[] {
  const requested: AuthMethodToken[] = []

  if (hasCredential(context.password)) {
    requested.push('password')
  }

  if (hasCredential(context.privateKey)) {
    requested.push('publickey')
  }

  if (context.requestedKeyboardInteractive === true) {
    requested.push('keyboard-interactive')
  }

  return dedupePreserveOrder(requested)
}

function hasCredential(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

function dedupePreserveOrder(methods: AuthMethodToken[]): AuthMethodToken[] {
  const seen = new Set<AuthMethodToken>()
  const result: AuthMethodToken[] = []

  for (const method of methods) {
    if (!seen.has(method)) {
      seen.add(method)
      result.push(method)
    }
  }

  return result
}

function toToken(method: AuthMethod): AuthMethodToken {
  return `${method}` as AuthMethodToken
}
