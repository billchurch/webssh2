// app/middleware/body-parser.middleware.ts
// Body parsing middleware for handling request bodies

import type { RequestHandler } from 'express'
import bodyParser from 'body-parser'

const { urlencoded, json } = bodyParser

/**
 * Create body parser middleware for URL-encoded and JSON bodies
 * @returns Array of Express middleware handlers
 */
export function createBodyParserMiddleware(): RequestHandler[] {
  return [
    urlencoded({ extended: true }), 
    json()
  ]
}