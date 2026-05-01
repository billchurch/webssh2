// app/services/theming/theme-color-keys.ts
// THEME_COLOR_KEYS allowlist constant

import type { ThemeColors } from '../../types/config.js'

export const THEME_COLOR_KEYS: readonly (keyof ThemeColors)[] = [
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
