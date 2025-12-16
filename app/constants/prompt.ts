/**
 * Prompt Constants
 *
 * Configuration values, limits, patterns, and defaults for the generic prompt system.
 *
 * @module constants/prompt
 */

// =============================================================================
// Prompt Type Literals
// =============================================================================

/**
 * Prompt types determining behavior and UI presentation
 */
export const PROMPT_TYPES = {
  /** Input prompt for collecting text/password values */
  INPUT: 'input',
  /** Confirmation prompt for yes/no/cancel decisions */
  CONFIRM: 'confirm',
  /** Notice prompt for information with OK acknowledgment */
  NOTICE: 'notice',
  /** Toast notification for brief status messages (fire-and-forget) */
  TOAST: 'toast',
} as const

export type PromptType = (typeof PROMPT_TYPES)[keyof typeof PROMPT_TYPES]

/**
 * Prompt severity levels for visual styling
 */
export const PROMPT_SEVERITY = {
  /** Informational message */
  INFO: 'info',
  /** Warning message */
  WARNING: 'warning',
  /** Error message */
  ERROR: 'error',
  /** Success message */
  SUCCESS: 'success',
} as const

export type PromptSeverityType = (typeof PROMPT_SEVERITY)[keyof typeof PROMPT_SEVERITY]

/**
 * Button variant types for visual styling
 */
export const PROMPT_BUTTON_VARIANTS = {
  /** Primary action button */
  PRIMARY: 'primary',
  /** Secondary/cancel button */
  SECONDARY: 'secondary',
  /** Destructive action button */
  DANGER: 'danger',
} as const

export type PromptButtonVariant = (typeof PROMPT_BUTTON_VARIANTS)[keyof typeof PROMPT_BUTTON_VARIANTS]

/**
 * Input field types
 */
export const PROMPT_INPUT_TYPES = {
  /** Plain text input */
  TEXT: 'text',
  /** Password input (masked) */
  PASSWORD: 'password',
  /** Multi-line text input */
  TEXTAREA: 'textarea',
} as const

export type PromptInputType = (typeof PROMPT_INPUT_TYPES)[keyof typeof PROMPT_INPUT_TYPES]

// =============================================================================
// Validation Limits
// =============================================================================

/**
 * Prompt validation limits
 */
export const PROMPT_LIMITS = {
  /** Maximum title length in characters */
  MAX_TITLE_LENGTH: 256,

  /** Maximum message length in characters */
  MAX_MESSAGE_LENGTH: 4096,

  /** Maximum button label length in characters */
  MAX_BUTTON_LABEL_LENGTH: 64,

  /** Maximum buttons per prompt */
  MAX_BUTTONS: 5,

  /** Maximum input fields per prompt */
  MAX_INPUTS: 10,

  /** Maximum input label length in characters */
  MAX_INPUT_LABEL_LENGTH: 128,

  /** Maximum input placeholder length in characters */
  MAX_INPUT_PLACEHOLDER_LENGTH: 256,

  /** Maximum input default value length in characters */
  MAX_INPUT_DEFAULT_VALUE_LENGTH: 4096,

  /** Maximum input response value length in characters */
  MAX_INPUT_VALUE_LENGTH: 10_000,

  /** Maximum action name length in characters */
  MAX_ACTION_LENGTH: 64,

  /** Maximum icon name length in characters */
  MAX_ICON_LENGTH: 64,

  /** Maximum pending prompts per socket */
  MAX_PENDING_PROMPTS_PER_SOCKET: 10,
} as const

export type PromptLimitKey = keyof typeof PROMPT_LIMITS

// =============================================================================
// Timeouts
// =============================================================================

/**
 * Prompt timeout configuration (in milliseconds)
 */
export const PROMPT_TIMEOUTS = {
  /** Default timeout for modal prompts (5 minutes) */
  DEFAULT_PROMPT_MS: 300_000,

  /** Minimum timeout for modal prompts (1 second) */
  MIN_PROMPT_MS: 1000,

  /** Maximum timeout for modal prompts (10 minutes) */
  MAX_PROMPT_MS: 600_000,

  /** Default timeout for toast notifications (5 seconds) */
  DEFAULT_TOAST_MS: 5000,

  /** Minimum timeout for toast notifications (1 second) */
  MIN_TOAST_MS: 1000,

  /** Maximum timeout for toast notifications (30 seconds) */
  MAX_TOAST_MS: 30_000,
} as const

export type PromptTimeoutKey = keyof typeof PROMPT_TIMEOUTS

// =============================================================================
// Validation Patterns
// =============================================================================

/**
 * Regular expression patterns for prompt validation
 */
export const PROMPT_PATTERNS = {
  /**
   * Valid action name pattern.
   * Must start with a letter, followed by letters, numbers, underscores, or hyphens.
   * Length 1-64 characters.
   */
  ACTION_NAME: /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/,

  /**
   * Valid input key pattern.
   * Must start with a letter, followed by letters, numbers, or underscores.
   * Length 1-64 characters.
   */
  INPUT_KEY: /^[a-zA-Z]\w{0,63}$/,

  /**
   * HTML tag detection pattern for XSS prevention.
   * Matches any HTML-like tags.
   */
  HTML_TAG: /<[^>]*>/,

  /**
   * UUID v4 pattern for prompt ID validation.
   */
  UUID_V4: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const

// =============================================================================
// Icon Whitelist
// =============================================================================

/**
 * Allowed icon names for prompts (whitelist for security).
 *
 * SECURITY: Only these exact icon names are permitted to prevent
 * path traversal, arbitrary code execution, and XSS via dynamic imports.
 *
 * Icons should correspond to lucide-solid package exports on the client.
 * Add new icons here as needed.
 */
export const ALLOWED_PROMPT_ICONS: ReadonlySet<string> = new Set([
  // Severity/Status icons (defaults)
  'info',
  'warning',
  'error',
  'success',
  'question',

  // Authentication & Security
  'lock',
  'unlock',
  'key',
  'shield',
  'user',
  'user-check',
  'user-x',
  'fingerprint',

  // File operations
  'file',
  'file-text',
  'file-question',
  'folder',
  'folder-open',
  'upload',
  'download',
  'trash',
  'save',
  'copy',

  // Connection & Network
  'wifi',
  'wifi-off',
  'globe',
  'server',
  'database',
  'link',
  'unlink',
  'refresh',

  // Actions & UI
  'settings',
  'help-circle',
  'message-square',
  'bell',
  'clock',
  'terminal',
  'code',
  'power',
  'log-out',
  'log-in',

  // Misc
  'eye',
  'eye-off',
  'search',
  'edit',
  'plus',
  'minus',
  'x',
  'check',
  'alert-triangle',
  'alert-circle',
  'check-circle',
  'x-circle',
  'loader',
])

/**
 * Check if an icon name is allowed
 */
export function isAllowedPromptIcon(icon: string): boolean {
  return ALLOWED_PROMPT_ICONS.has(icon)
}

// =============================================================================
// Default Button Configurations
// =============================================================================

/**
 * Default button configurations by prompt type
 */
export const DEFAULT_PROMPT_BUTTONS = {
  /** Default buttons for input prompts */
  INPUT: [
    { action: 'submit', label: 'Submit', variant: PROMPT_BUTTON_VARIANTS.PRIMARY },
    { action: 'cancel', label: 'Cancel', variant: PROMPT_BUTTON_VARIANTS.SECONDARY },
  ],

  /** Default buttons for confirmation prompts */
  CONFIRM: [
    { action: 'confirm', label: 'Yes', variant: PROMPT_BUTTON_VARIANTS.PRIMARY },
    { action: 'cancel', label: 'No', variant: PROMPT_BUTTON_VARIANTS.SECONDARY },
  ],

  /** Default buttons for notice prompts */
  NOTICE: [
    { action: 'ok', label: 'OK', variant: PROMPT_BUTTON_VARIANTS.PRIMARY },
  ],
} as const

// =============================================================================
// Reserved Action Names
// =============================================================================

/**
 * Reserved action names that have special meaning
 */
export const RESERVED_ACTIONS = {
  /** User submitted the prompt (for input prompts) */
  SUBMIT: 'submit',
  /** User cancelled the prompt */
  CANCEL: 'cancel',
  /** User confirmed the action (for confirm prompts) */
  CONFIRM: 'confirm',
  /** User acknowledged the notice */
  OK: 'ok',
  /** Prompt was dismissed without action (backdrop click, escape) */
  DISMISSED: 'dismissed',
  /** Prompt timed out */
  TIMEOUT: 'timeout',
} as const

export type ReservedAction = (typeof RESERVED_ACTIONS)[keyof typeof RESERVED_ACTIONS]
