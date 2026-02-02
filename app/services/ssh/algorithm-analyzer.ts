// app/services/ssh/algorithm-analyzer.ts
// Pure functions for analyzing SSH algorithm compatibility between client and server

import type { AlgorithmSet } from './algorithm-capture.js'
import { ALGORITHM_PRESETS, type Algorithms } from '../../config/algorithm-presets.js'
import { CATEGORY_TO_ENV_VAR, type AlgorithmCategory } from '../../constants/algorithm-env-vars.js'

// Re-export for consumers
export type { AlgorithmCategory }

/**
 * Analysis result for a single algorithm category
 */
export interface CategoryAnalysis {
  category: AlgorithmCategory
  label: string
  common: string[]
  clientOnly: string[]
  serverOnly: string[]
  hasMatch: boolean
}

/**
 * Complete analysis of algorithm compatibility
 */
export interface AlgorithmAnalysis {
  categories: CategoryAnalysis[]
  hasAnyMismatch: boolean
  suggestedPreset: string | null
  suggestedEnvVars: string[]
}

/**
 * Human-readable labels for algorithm categories
 */
const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
  kex: 'Key Exchange',
  serverHostKey: 'Host Key',
  cipher: 'Cipher',
  mac: 'MAC',
  compress: 'Compression'
}

/**
 * Find algorithms that exist in both client and server lists
 * @pure
 */
export const findCommonAlgorithms = (
  clientList: string[],
  serverList: string[]
): string[] => {
  const serverSet = new Set(serverList)
  return clientList.filter(alg => serverSet.has(alg))
}

/**
 * Find algorithms in first list that are not in second list
 * @pure
 */
const findExclusiveAlgorithms = (
  list: string[],
  otherList: string[]
): string[] => {
  const otherSet = new Set(otherList)
  return list.filter(alg => !otherSet.has(alg))
}

/**
 * Analyze a single algorithm category for compatibility
 * @pure
 */
const analyzeCategory = (
  category: AlgorithmCategory,
  clientAlgorithms: string[],
  serverAlgorithms: string[]
): CategoryAnalysis => {
  const common = findCommonAlgorithms(clientAlgorithms, serverAlgorithms)
  const clientOnly = findExclusiveAlgorithms(clientAlgorithms, serverAlgorithms)
  const serverOnly = findExclusiveAlgorithms(serverAlgorithms, clientAlgorithms)

  return {
    category,
    // eslint-disable-next-line security/detect-object-injection -- category is typed as keyof AlgorithmSet
    label: CATEGORY_LABELS[category],
    common,
    clientOnly,
    serverOnly,
    hasMatch: common.length > 0
  }
}

/**
 * Check if a preset covers all server algorithms (at least one common per category)
 * @pure
 */
const presetCoversServer = (
  preset: Algorithms,
  server: AlgorithmSet
): boolean => {
  // Map preset fields to AlgorithmSet fields
  const categoryMappings: Array<{ presetKey: keyof Algorithms, serverKey: AlgorithmCategory }> = [
    { presetKey: 'kex', serverKey: 'kex' },
    { presetKey: 'serverHostKey', serverKey: 'serverHostKey' },
    { presetKey: 'cipher', serverKey: 'cipher' },
    { presetKey: 'hmac', serverKey: 'mac' },
    { presetKey: 'compress', serverKey: 'compress' }
  ]

  for (const { presetKey, serverKey } of categoryMappings) {
    // eslint-disable-next-line security/detect-object-injection -- presetKey and serverKey are typed as keyof
    const presetAlgorithms = preset[presetKey]
    // eslint-disable-next-line security/detect-object-injection -- serverKey is typed as keyof AlgorithmSet
    const serverAlgorithms = server[serverKey]

    // If server has algorithms in this category, we need at least one match
    if (serverAlgorithms.length > 0) {
      const common = findCommonAlgorithms(presetAlgorithms, serverAlgorithms)
      if (common.length === 0) {
        return false
      }
    }
  }

  return true
}

/**
 * Suggest the best preset to use based on server's algorithm support.
 * Tries presets in order of security preference: strict > modern > legacy
 * @pure
 */
export const suggestPreset = (server: AlgorithmSet): string | null => {
  // Try presets in order of security preference
  const presetOrder = ['strict', 'modern', 'legacy']

  for (const presetName of presetOrder) {
    // eslint-disable-next-line security/detect-object-injection -- presetName is from known static list
    const preset = ALGORITHM_PRESETS[presetName]
    if (preset !== undefined && presetCoversServer(preset, server)) {
      return presetName
    }
  }

  return null
}

/**
 * Generate environment variable suggestions for categories with no match.
 * Uses the first algorithm from the server's list for each mismatched category.
 * @pure
 */
export const generateEnvVarSuggestions = (
  analysis: CategoryAnalysis[]
): string[] => {
  const suggestions: string[] = []

  for (const categoryAnalysis of analysis) {
    if (!categoryAnalysis.hasMatch && categoryAnalysis.serverOnly.length > 0) {
      const envVar = CATEGORY_TO_ENV_VAR[categoryAnalysis.category]
      // Suggest the first server algorithm for this category
      const firstServerAlg = categoryAnalysis.serverOnly[0]
      if (firstServerAlg !== undefined) {
        suggestions.push(`${envVar}=${firstServerAlg}`)
      }
    }
  }

  return suggestions
}

/**
 * Perform full algorithm compatibility analysis between client and server.
 * Returns detailed mismatch information and configuration suggestions.
 * @pure
 */
export const analyzeAlgorithms = (
  client: AlgorithmSet,
  server: AlgorithmSet
): AlgorithmAnalysis => {
  const categories: AlgorithmCategory[] = ['kex', 'serverHostKey', 'cipher', 'mac', 'compress']

  const categoryAnalyses = categories.map(category =>
    // eslint-disable-next-line security/detect-object-injection -- category is typed as keyof AlgorithmSet
    analyzeCategory(category, client[category], server[category])
  )

  // A mismatch exists if any category has algorithms on both sides but no common ones
  const hasAnyMismatch = categoryAnalyses.some(
    analysis =>
      !analysis.hasMatch &&
      (analysis.clientOnly.length > 0 || analysis.serverOnly.length > 0)
  )

  const suggestedPresetValue = hasAnyMismatch ? suggestPreset(server) : null
  const suggestedEnvVars = hasAnyMismatch
    ? generateEnvVarSuggestions(categoryAnalyses)
    : []

  return {
    categories: categoryAnalyses,
    hasAnyMismatch,
    suggestedPreset: suggestedPresetValue,
    suggestedEnvVars
  }
}
