// app/routes/handlers/index.ts
// Central exports for route handlers

export {
  handleConnection,
  extractConnectionParams,
} from './connection.handler.js'

export {
  handleSSHAuth,
  getStatusCodeForError,
  formatErrorResponse,
  type AuthParams,
  type AuthResult,
} from './ssh-auth.handler.js'

export {
  validateRouteParams,
  extractQueryParams,
  extractBodyParams,
  type RouteParams,
  type ValidationResult,
} from './route-validators.js'