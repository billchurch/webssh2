// app/auth/providers/index.ts
// Central exports for authentication providers

export type { AuthProvider, AuthMethod } from './auth-provider.interface.js'
export { BasicAuthProvider } from './basic-auth.provider.js'
export { PostAuthProvider } from './post-auth.provider.js'
export { ManualAuthProvider } from './manual-auth.provider.js'