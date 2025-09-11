export function deepMerge<T>(target: T, source: unknown): T
export function getValidatedHost(host: string): string
export function getValidatedPort(portInput?: string): number

export interface Credentials {
  username?: string
  host?: string
  port?: number
  password?: string
  privateKey?: string
  passphrase?: string
}
export function isValidCredentials(creds: Credentials): boolean

export function validateSshTerm(term?: string): string | null
export function validateConfig(config: unknown): unknown
export function modifyHtml(html: string, config: unknown): string
export function maskSensitiveData(obj: unknown, options?: unknown): unknown
export function isValidEnvKey(key: string): boolean
export function isValidEnvValue(value: string): boolean
export function parseEnvVars(envString: string): Record<string, string> | null
