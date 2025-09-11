import type { RequestHandler } from 'express'
import * as Impl from './security-headers.impl.js'

export const CSP_CONFIG: Record<string, string[]> = Impl.CSP_CONFIG as Record<string, string[]>

export const SECURITY_HEADERS: Record<string, string> = Impl.SECURITY_HEADERS as Record<
  string,
  string
>

export const generateCSPHeader: () => string = Impl.generateCSPHeader as unknown as () => string

import type { Config } from './types/config.js'
export const createSecurityHeadersMiddleware: (config?: Partial<Config>) => RequestHandler =
  Impl.createSecurityHeadersMiddleware as unknown as (config?: Partial<Config>) => RequestHandler

export const createCSPMiddleware: (
  customCSP?: Partial<Record<keyof typeof CSP_CONFIG, string[]>>
) => RequestHandler = Impl.createCSPMiddleware as unknown as (
  customCSP?: Partial<Record<keyof typeof CSP_CONFIG, string[]>>
) => RequestHandler
