/**
 * Theme name canonicalization helpers.
 *
 * Canonicalization is NFKC-normalize → trim → collapse internal whitespace →
 * lowercase. Reserved sentinels ("default", "custom") are matched case- and
 * whitespace-insensitively against this canonical form.
 */

export const THEME_NAME_REGEX = /^[\w .\-()]{1,64}$/u

const RESERVED = new Set(['default', 'custom'])

export function canonicalizeThemeName(name: string): string {
  return name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function isReservedThemeName(name: string): boolean {
  return RESERVED.has(canonicalizeThemeName(name))
}
