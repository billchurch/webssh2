/**
 * Branded types for domain modeling and type safety
 */

// Session-related branded types
export type SessionId = string & { readonly __brand: 'SessionId' }
export type UserId = string & { readonly __brand: 'UserId' }
export type ConnectionId = string & { readonly __brand: 'ConnectionId' }
export type SocketId = string & { readonly __brand: 'SocketId' }

// Constructor functions for branded types
export const createSessionId = (id: string): SessionId => id as SessionId
export const createUserId = (id: string): UserId => id as UserId
export const createConnectionId = (id: string): ConnectionId => id as ConnectionId
export const createSocketId = (id: string): SocketId => id as SocketId

// Type guards
export const isSessionId = (value: unknown): value is SessionId =>
  typeof value === 'string' && value.length > 0

export const isUserId = (value: unknown): value is UserId =>
  typeof value === 'string' && value.length > 0

export const isConnectionId = (value: unknown): value is ConnectionId =>
  typeof value === 'string' && value.length > 0

export const isSocketId = (value: unknown): value is SocketId =>
  typeof value === 'string' && value.length > 0