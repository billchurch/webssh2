/**
 * Branded types for domain modeling and type safety
 */

// Generic branded type utility
export type Branded<T, B> = T & { readonly __brand: B }

// Session-related branded types
export type SessionId = string & { readonly __brand: 'SessionId' }
export type UserId = string & { readonly __brand: 'UserId' }
export type ConnectionId = string & { readonly __brand: 'ConnectionId' }
export type SocketId = string & { readonly __brand: 'SocketId' }

// SSH-related branded types
export type SshHost = string & { readonly __brand: 'SshHost' }
export type SshPort = number & { readonly __brand: 'SshPort' }
export type AuthMethodToken = 'password' | 'keyboard-interactive' | 'publickey'
export type AuthMethod = Branded<AuthMethodToken, 'AuthMethod'>

// SFTP-related branded types
export type TransferId = string & { readonly __brand: 'TransferId' }

// Prompt-related branded types
export type PromptId = string & { readonly __brand: 'PromptId' }

// File system branded types
export type FilePath = string & { readonly __brand: 'FilePath' }

// UI-related branded types
export type CssColor = string & { readonly __brand: 'CssColor' }

// Constructor functions for branded types
export const createSessionId = (id: string): SessionId => id as SessionId
export const createUserId = (id: string): UserId => id as UserId
export const createConnectionId = (id: string): ConnectionId => id as ConnectionId
export const createSocketId = (id: string): SocketId => id as SocketId
export const createAuthMethod = (method: AuthMethodToken): AuthMethod => method as AuthMethod
export const createTransferId = (id: string): TransferId => id as TransferId
export const createPromptId = (id: string): PromptId => id as PromptId

// Type guards
export const isSessionId = (value: unknown): value is SessionId =>
  typeof value === 'string' && value.length > 0

export const isUserId = (value: unknown): value is UserId =>
  typeof value === 'string' && value.length > 0

export const isConnectionId = (value: unknown): value is ConnectionId =>
  typeof value === 'string' && value.length > 0

export const isSocketId = (value: unknown): value is SocketId =>
  typeof value === 'string' && value.length > 0

export const isAuthMethod = (value: unknown): value is AuthMethod =>
  value === 'password' ||
  value === 'keyboard-interactive' ||
  value === 'publickey'

export const isTransferId = (value: unknown): value is TransferId =>
  typeof value === 'string' && value.length > 0

export const isPromptId = (value: unknown): value is PromptId =>
  typeof value === 'string' && value.length > 0 && value.length <= 128
