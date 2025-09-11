import type { RequestHandler, Application } from 'express'
import type { Config } from './types/config.js'
import * as Impl from './middleware.impl.js'

export const createAuthMiddleware: (config: Config) => RequestHandler =
  Impl.createAuthMiddleware as unknown as (config: Config) => RequestHandler

export const createSessionMiddleware: (config: Config) => RequestHandler =
  Impl.createSessionMiddleware as unknown as (config: Config) => RequestHandler

export const createBodyParserMiddleware: () => RequestHandler[] =
  Impl.createBodyParserMiddleware as unknown as () => RequestHandler[]

export const createCookieMiddleware: () => RequestHandler =
  Impl.createCookieMiddleware as unknown as () => RequestHandler

export const createSSOAuthMiddleware: (config: Config) => RequestHandler =
  Impl.createSSOAuthMiddleware as unknown as (config: Config) => RequestHandler

export const createCSRFMiddleware: (config: Config) => RequestHandler =
  Impl.createCSRFMiddleware as unknown as (config: Config) => RequestHandler

export const applyMiddleware: (
  app: Application,
  config: Config
) => { sessionMiddleware: RequestHandler } = Impl.applyMiddleware as unknown as (
  app: Application,
  config: Config
) => { sessionMiddleware: RequestHandler }
