/**
 * Theme color keys allowlist for terminal theming.
 * The validator iterates these keys (not input keys) to defend against
 * prototype-pollution. The set provides O(1) membership checks.
 */

import type { ThemeColors } from '../../types/config.js'

export const THEME_COLOR_KEYS: ReadonlyArray<keyof ThemeColors> = [
  'background',
  'foreground',
  'cursor',
  'cursorAccent',
  'selectionBackground',
  'selectionForeground',
  'selectionInactiveBackground',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite'
] as const

export const THEME_COLOR_KEY_SET: ReadonlySet<keyof ThemeColors> = new Set(
  THEME_COLOR_KEYS
)
