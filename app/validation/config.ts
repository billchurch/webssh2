// app/validation/config.ts
// Configuration validation functions

import type { SshHost, SshPort, CssColor } from '../types/branded.js'

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

const CSS_COLOR_RE = /^[a-zA-Z0-9#(),.\s-]+$/

/**
 * Validate CSS color
 *
 * Accepts named colors, hex colors, and basic rgb()/rgba()/hsl()/hsla()
 * function notation. Rejects anything containing CSS injection characters
 * (semicolons, curly braces, etc.).
 */
export function validateCssColor(color: string | null | undefined): CssColor | undefined {
  if (color == null || color === '') {
    return undefined
  }
  if (!CSS_COLOR_RE.test(color)) {
    return undefined
  }
  return color as CssColor
}

