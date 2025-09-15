// server
// app/logger.ts

import createDebug, { type Debugger } from 'debug'

export function createNamespacedDebug(namespace: string): Debugger {
  return createDebug(`webssh2:${namespace}`)
}

export function logError(message: string, error?: Error): void {
  console.error(message)
  if (error != null) {
    console.error(`ERROR: ${String(error)}`)
  }
}
