// Terminal-specific constants
// app/constants/terminal.ts

export const TERMINAL_DEFAULTS = {
  // Default dimensions
  COLS: 80,
  ROWS: 24,
  DEFAULT_COLS: 80,
  DEFAULT_ROWS: 24,

  // Terminal types
  TERM: 'xterm-256color',
  DEFAULT_TERM: 'xterm-256color',
  SUPPORTED_TERMS: [
    'xterm',
    'xterm-color',
    'xterm-256color',
    'vt100',
    'vt220',
    'linux',
    'screen',
    'screen-256color',
    'tmux',
    'tmux-256color'
  ] as const,
  
  // Terminal buffer
  DEFAULT_SCROLLBACK: 1000,
  MAX_SCROLLBACK: 10000,
  
  // Terminal encoding
  DEFAULT_ENCODING: 'utf-8',
  SUPPORTED_ENCODINGS: ['utf-8', 'ascii'] as const,
} as const

export const LINE_ENDINGS = {
  LF: '\n',
  CR: '\r',
  CRLF: '\r\n',
} as const

export const TERMINAL_COLORS = {
  // ANSI color codes
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  UNDERSCORE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',
  
  // Foreground colors
  FG_BLACK: '\x1b[30m',
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',
  FG_DEFAULT: '\x1b[39m',
  
  // Background colors
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',
  BG_DEFAULT: '\x1b[49m',
} as const

export const TERMINAL_COMMANDS = {
  // Cursor movement
  CURSOR_UP: '\x1b[A',
  CURSOR_DOWN: '\x1b[B',
  CURSOR_RIGHT: '\x1b[C',
  CURSOR_LEFT: '\x1b[D',
  CURSOR_HOME: '\x1b[H',
  CURSOR_SAVE: '\x1b[s',
  CURSOR_RESTORE: '\x1b[u',
  
  // Screen commands
  CLEAR_SCREEN: '\x1b[2J',
  CLEAR_LINE: '\x1b[2K',
  CLEAR_TO_EOL: '\x1b[K',
  CLEAR_TO_BOL: '\x1b[1K',
} as const

export type TerminalType = typeof TERMINAL_DEFAULTS.SUPPORTED_TERMS[number]
export type TerminalEncoding = typeof TERMINAL_DEFAULTS.SUPPORTED_ENCODINGS[number]