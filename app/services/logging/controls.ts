// app/services/logging/controls.ts
// Pure utilities for evaluating logging sampling and rate limit controls

import type {
  LoggingControlsConfig,
  LoggingRateLimitRule,
  LoggingSamplingRule
} from '../../types/config.js'

export interface LoggingControlMetrics {
  readonly published: number
  readonly droppedBySampling: number
  readonly droppedByRateLimit: number
}

export interface LoggingControlState {
  readonly rateLimitBuckets: ReadonlyMap<string, RateLimitBucketState>
  readonly metrics: LoggingControlMetrics
}

export interface LoggingControlDecisionDetails {
  readonly samplingRate?: number
  readonly rateLimit?: {
    readonly target: string
    readonly remainingTokens: number
  }
}

export interface LoggingControlDecision {
  readonly allow: boolean
  readonly reason?: 'sampling' | 'rate_limit'
  readonly details?: LoggingControlDecisionDetails
  readonly updatedState: LoggingControlState
}

export interface EvaluateLoggingControlsOptions {
  readonly event: string
  readonly nowMs: number
  readonly config?: LoggingControlsConfig
  readonly state?: LoggingControlState
  readonly random?: () => number
}

interface RateLimitEvaluationResult {
  readonly allow: boolean
  readonly buckets: ReadonlyMap<string, RateLimitBucketState>
  readonly appliedRule?: LoggingRateLimitRule
  readonly remainingTokens?: number
}

interface SamplingEvaluationResult {
  readonly allow: boolean
  readonly appliedRate: number
}

interface RateLimitBucketState {
  readonly tokens: number
  readonly lastRefillMs: number
}

const INITIAL_METRICS: LoggingControlMetrics = {
  published: 0,
  droppedBySampling: 0,
  droppedByRateLimit: 0
}

export function createLoggingControlState(): LoggingControlState {
  return {
    rateLimitBuckets: new Map<string, RateLimitBucketState>(),
    metrics: { ...INITIAL_METRICS }
  }
}

export function evaluateLoggingControls(
  options: EvaluateLoggingControlsOptions
): LoggingControlDecision {
  const baseState = options.state ?? createLoggingControlState()
  const randomFn = options.random ?? Math.random

  if (options.config === undefined) {
    return permit(baseState, baseState.rateLimitBuckets)
  }

  const samplingResult = evaluateSampling(options.event, options.config.sampling, randomFn)
  if (samplingResult.allow === false) {
    return dropForSampling(baseState, samplingResult.appliedRate)
  }

  const rateResult = evaluateRateLimit(
    options.event,
    options.nowMs,
    options.config.rateLimit,
    baseState.rateLimitBuckets
  )

  if (rateResult.allow === false) {
    return dropForRateLimit(baseState, rateResult)
  }

  const details = createSuccessDetails(samplingResult, rateResult)
  return permit(baseState, rateResult.buckets, details)
}

function evaluateSampling(
  event: string,
  config: LoggingControlsConfig['sampling'],
  random: () => number
): SamplingEvaluationResult {
  if (config === undefined) {
    return { allow: true, appliedRate: 1 }
  }

  const rule = selectSamplingRule(config.rules, event)
  const rate = rule?.sampleRate ?? config.defaultSampleRate ?? 1

  if (rate >= 1) {
    return { allow: true, appliedRate: 1 }
  }

  if (rate <= 0) {
    return { allow: false, appliedRate: 0 }
  }

  const decision = random() < rate
  return { allow: decision, appliedRate: rate }
}

function selectSamplingRule(
  rules: readonly LoggingSamplingRule[] | undefined,
  event: string
): LoggingSamplingRule | undefined {
  if (rules === undefined) {
    return undefined
  }

  let wildcard: LoggingSamplingRule | undefined
  for (const rule of rules) {
    if (rule.target === event) {
      return rule
    }
    if (rule.target === '*' && wildcard === undefined) {
      wildcard = rule
    }
  }
  return wildcard
}

function evaluateRateLimit(
  event: string,
  nowMs: number,
  config: LoggingControlsConfig['rateLimit'],
  buckets: ReadonlyMap<string, RateLimitBucketState>
): RateLimitEvaluationResult {
  if (config?.rules === undefined || config.rules.length === 0) {
    return { allow: true, buckets }
  }

  const rule = selectRateLimitRule(config.rules, event)
  if (rule === undefined) {
    return { allow: true, buckets }
  }

  const bucketKey = rule.target === '*' ? '*' : event
  const capacity = rule.limit + (rule.burst ?? 0)

  if (capacity <= 0) {
    return {
      allow: false,
      appliedRule: rule,
      buckets: upsertBucket(buckets, bucketKey, { tokens: 0, lastRefillMs: nowMs }),
      remainingTokens: 0
    }
  }

  const previous = buckets.get(bucketKey)
  const refilled = refillBucket(previous, rule, nowMs, capacity)

  if (refilled.tokens <= 0) {
    return {
      allow: false,
      appliedRule: rule,
      buckets: upsertBucket(buckets, bucketKey, refilled),
      remainingTokens: refilled.tokens
    }
  }

  const updated: RateLimitBucketState = {
    tokens: refilled.tokens - 1,
    lastRefillMs: refilled.lastRefillMs
  }

  return {
    allow: true,
    appliedRule: rule,
    buckets: upsertBucket(buckets, bucketKey, updated),
    remainingTokens: updated.tokens
  }
}

function selectRateLimitRule(
  rules: readonly LoggingRateLimitRule[],
  event: string
): LoggingRateLimitRule | undefined {
  let wildcard: LoggingRateLimitRule | undefined
  for (const rule of rules) {
    if (rule.target === event) {
      return rule
    }
    if (rule.target === '*' && wildcard === undefined) {
      wildcard = rule
    }
  }
  return wildcard
}

function refillBucket(
  previous: RateLimitBucketState | undefined,
  rule: LoggingRateLimitRule,
  nowMs: number,
  capacity: number
): RateLimitBucketState {
  if (previous === undefined) {
    return { tokens: capacity, lastRefillMs: nowMs }
  }

  if (nowMs <= previous.lastRefillMs) {
    return previous
  }

  const elapsed = nowMs - previous.lastRefillMs
  const intervals = Math.floor(elapsed / rule.intervalMs)

  if (intervals <= 0) {
    return previous
  }

  const replenished = Math.min(previous.tokens + intervals * rule.limit, capacity)
  const lastRefillMs = previous.lastRefillMs + intervals * rule.intervalMs

  return {
    tokens: replenished,
    lastRefillMs
  }
}

function upsertBucket(
  buckets: ReadonlyMap<string, RateLimitBucketState>,
  key: string,
  value: RateLimitBucketState
): ReadonlyMap<string, RateLimitBucketState> {
  const next = new Map(buckets)
  next.set(key, value)
  return next
}

function permit(
  state: LoggingControlState,
  buckets: ReadonlyMap<string, RateLimitBucketState>,
  details?: LoggingControlDecisionDetails
): LoggingControlDecision {
  return {
    allow: true,
    ...(details === undefined ? {} : { details }),
    updatedState: {
      rateLimitBuckets: buckets,
      metrics: incrementPublished(state.metrics)
    }
  }
}

function dropForSampling(
  state: LoggingControlState,
  appliedRate: number
): LoggingControlDecision {
  return {
    allow: false,
    reason: 'sampling',
    details: { samplingRate: appliedRate },
    updatedState: {
      rateLimitBuckets: state.rateLimitBuckets,
      metrics: incrementDroppedBySampling(state.metrics)
    }
  }
}

function dropForRateLimit(
  state: LoggingControlState,
  result: RateLimitEvaluationResult
): LoggingControlDecision {
  const details =
    result.appliedRule === undefined
      ? undefined
      : {
          rateLimit: {
            target: result.appliedRule.target,
            remainingTokens: result.remainingTokens ?? 0
          }
        }

  return {
    allow: false,
    reason: 'rate_limit',
    ...(details === undefined ? {} : { details }),
    updatedState: {
      rateLimitBuckets: result.buckets,
      metrics: incrementDroppedByRateLimit(state.metrics)
    }
  }
}

function incrementPublished(metrics: LoggingControlMetrics): LoggingControlMetrics {
  return {
    published: metrics.published + 1,
    droppedBySampling: metrics.droppedBySampling,
    droppedByRateLimit: metrics.droppedByRateLimit
  }
}

function incrementDroppedBySampling(metrics: LoggingControlMetrics): LoggingControlMetrics {
  return {
    published: metrics.published,
    droppedBySampling: metrics.droppedBySampling + 1,
    droppedByRateLimit: metrics.droppedByRateLimit
  }
}

function incrementDroppedByRateLimit(metrics: LoggingControlMetrics): LoggingControlMetrics {
  return {
    published: metrics.published,
    droppedBySampling: metrics.droppedBySampling,
    droppedByRateLimit: metrics.droppedByRateLimit + 1
  }
}

function createSuccessDetails(
  sampling: SamplingEvaluationResult,
  rate: RateLimitEvaluationResult
): LoggingControlDecisionDetails | undefined {
  const includeSampling = sampling.appliedRate > 0 && sampling.appliedRate < 1
  const rule = rate.appliedRule
  const includeRate = rule !== undefined

  if (!includeSampling && !includeRate) {
    return undefined
  }

  return {
    ...(includeSampling ? { samplingRate: sampling.appliedRate } : {}),
    ...(includeRate
      ? {
          rateLimit: {
            target: rule.target,
            remainingTokens: rate.remainingTokens ?? 0
          }
        }
      : {})
  }
}
