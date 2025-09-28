// app/schemas/config-schema.ts
// Zod schema for configuration validation

import { z } from 'zod'

/**
 * IPv4 validation function
 * Validates IPv4 addresses without regex for security
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) {
    return false
  }

  for (const part of parts) {
    const num = Number.parseInt(part, 10)
    if (Number.isNaN(num) || num < 0 || num > 255) {
      return false
    }
    if (part.length > 1 && part.startsWith('0')) {
      return false // no leading zeros
    }
  }
  return true
}

/**
 * SSH algorithms schema
 */
const AlgorithmsSchema = z.object({
  cipher: z.array(z.string()),
  compress: z.array(z.string()),
  hmac: z.array(z.string()),
  kex: z.array(z.string()),
  serverHostKey: z.array(z.string())
})

/**
 * Listen configuration schema
 */
const ListenSchema = z.object({
  ip: z.string().refine(isValidIPv4, { message: 'Invalid IPv4 address' }),
  port: z.number().int().min(1).max(65535)
})

/**
 * HTTP configuration schema
 */
const HttpSchema = z.object({
  origins: z.array(z.string())
})

/**
 * User credentials schema
 */
const UserSchema = z.object({
  name: z.string().nullable(),
  password: z.string().nullable(),
  privateKey: z.string().nullable(),
  passphrase: z.string().nullable()
})

/**
 * SSH configuration schema
 */
const SSHSchema = z.object({
  host: z.string().nullable(),
  port: z.number().int().min(1).max(65535),
  localAddress: z.string().optional(),
  localPort: z.number().int().min(1).max(65535).optional(),
  term: z.string(),
  readyTimeout: z.number().int().positive(),
  keepaliveInterval: z.number().int().positive(),
  keepaliveCountMax: z.number().int().positive(),
  allowedSubnets: z.array(z.string()).optional(),
  alwaysSendKeyboardInteractivePrompts: z.boolean(),
  disableInteractiveAuth: z.boolean(),
  algorithms: AlgorithmsSchema,
  envAllowlist: z.array(z.string()).optional()
})

/**
 * Header configuration schema
 */
const HeaderSchema = z.object({
  text: z.string().nullable(),
  background: z.string()
})

/**
 * Options configuration schema
 */
const OptionsSchema = z.object({
  challengeButton: z.boolean(),
  autoLog: z.boolean(),
  allowReauth: z.boolean(),
  allowReconnect: z.boolean(),
  allowReplay: z.boolean(),
  replayCRLF: z.boolean().optional()
})

/**
 * Session configuration schema
 */
const SessionSchema = z.object({
  secret: z.string().min(1, 'Session secret is required'),
  name: z.string(),
  sessionTimeout: z.number().int().positive().optional(),
  maxHistorySize: z.number().int().positive().optional()
})

/**
 * SSO header mapping schema
 */
const SsoHeaderMappingSchema = z.object({
  username: z.string(),
  password: z.string(),
  session: z.string(),
  sessionId: z.string().optional(),
  host: z.string().optional(),
  port: z.string().optional(),
  algorithm: z.string().optional()
})

/**
 * SSO configuration schema
 */
const SsoSchema = z.object({
  enabled: z.boolean(),
  csrfProtection: z.boolean(),
  trustedProxies: z.array(z.string()),
  headerMapping: SsoHeaderMappingSchema
})

/**
 * Terminal configuration schema (optional)
 */
const TerminalSchema = z.object({
  rows: z.number().int().positive().optional(),
  cols: z.number().int().positive().optional(),
  term: z.string().optional()
}).optional()

/**
 * Logging configuration schema (optional)
 */
const LoggingSchema = z.object({
  namespace: z.string().optional()
}).optional()

/**
 * Main configuration schema
 */
export const ConfigSchema = z.object({
  listen: ListenSchema,
  http: HttpSchema,
  user: UserSchema,
  ssh: SSHSchema,
  header: HeaderSchema,
  options: OptionsSchema,
  session: SessionSchema,
  sso: SsoSchema,
  terminal: TerminalSchema,
  logging: LoggingSchema,
  allowedSubnets: z.array(z.string()).optional(),
  safeShutdownDuration: z.number().int().positive().optional()
})

/**
 * Inferred Config type from the schema
 * This replaces the need for a separate Config interface
 */
export type ConfigFromSchema = z.infer<typeof ConfigSchema>

/**
 * Partial config for merging with defaults
 */
export type PartialConfig = z.input<typeof ConfigSchema>