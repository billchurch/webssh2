// app/validation/config.ts
// Configuration validation functions

import type { SshHost, SshPort, FilePath, CssColor } from '../types/branded.js'

/**
 * Validate SSH host
 */
export function validateSshHost(host: string | null | undefined): SshHost | null {
  if (host == null || host === '') {
    return null
  }
  
  // Basic validation
  if (host.includes(' ')) {
    throw new Error(`Invalid SSH host: ${host} (contains spaces)`)
  }
  
  return host as SshHost
}

/**
 * Validate SSH port
 */
export function validateSshPort(port: number = 22): SshPort {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid SSH port: ${port}`)
  }
  return port as SshPort
}

/**
 * Validate CSS color
 */
export function validateCssColor(color: string | undefined): CssColor | undefined {
  if (color == null || color === '') {
    return undefined
  }
  // Basic validation - could be enhanced with actual CSS color validation
  return color as CssColor
}

/**
 * Validate file path
 */
export function validateFilePath(path: string | undefined): FilePath | undefined {
  if (path == null || path === '') {
    return undefined
  }
  return path as FilePath
}