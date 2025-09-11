import type { RequestHandler } from 'express'
import type { Config } from './types/config.js'
export const CSP_CONFIG: Record<string, string[]>
export const SECURITY_HEADERS: Record<string, string>
export function generateCSPHeader(): string
export function createSecurityHeadersMiddleware(config?: Partial<Config>): RequestHandler
export function createCSPMiddleware(
  customCSP?: Partial<Record<keyof typeof CSP_CONFIG, string[]>>
): RequestHandler
