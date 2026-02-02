// app/constants/algorithm-env-vars.ts
// Single source of truth for SSH algorithm environment variable names

import type { AlgorithmSet } from '../services/ssh/algorithm-capture.js'

/**
 * SSH Algorithm environment variable names.
 * Single source of truth - import this instead of hardcoding env var names.
 */
export const ALGORITHM_ENV_VARS = {
  PRESET: 'WEBSSH2_SSH_ALGORITHMS_PRESET',
  KEX: 'WEBSSH2_SSH_ALGORITHMS_KEX',
  CIPHER: 'WEBSSH2_SSH_ALGORITHMS_CIPHER',
  HMAC: 'WEBSSH2_SSH_ALGORITHMS_HMAC',
  COMPRESS: 'WEBSSH2_SSH_ALGORITHMS_COMPRESS',
  SERVER_HOST_KEY: 'WEBSSH2_SSH_ALGORITHMS_SERVER_HOST_KEY'
} as const

export type AlgorithmEnvVar = typeof ALGORITHM_ENV_VARS[keyof typeof ALGORITHM_ENV_VARS]

/** Algorithm category type (matches keyof AlgorithmSet) */
export type AlgorithmCategory = keyof AlgorithmSet

/** Map from AlgorithmCategory to env var name (for generating user suggestions) */
export const CATEGORY_TO_ENV_VAR: Record<AlgorithmCategory, AlgorithmEnvVar> = {
  kex: ALGORITHM_ENV_VARS.KEX,
  serverHostKey: ALGORITHM_ENV_VARS.SERVER_HOST_KEY,
  cipher: ALGORITHM_ENV_VARS.CIPHER,
  mac: ALGORITHM_ENV_VARS.HMAC,
  compress: ALGORITHM_ENV_VARS.COMPRESS
}
