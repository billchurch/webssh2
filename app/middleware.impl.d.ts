import type { RequestHandler, Application } from 'express'
import type { Config } from './types/config.js'
export function createAuthMiddleware(config: Config): RequestHandler
export function createSessionMiddleware(config: Config): RequestHandler
export function createBodyParserMiddleware(): RequestHandler[]
export function createCookieMiddleware(): RequestHandler
export function createSSOAuthMiddleware(config: Config): RequestHandler
export function createCSRFMiddleware(config: Config): RequestHandler
export function applyMiddleware(
  app: Application,
  config: Config
): { sessionMiddleware: RequestHandler }
