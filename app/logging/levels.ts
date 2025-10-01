// app/logging/levels.ts
// Utilities for working with logging levels

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function shouldLog(level: LogLevel, minimum: LogLevel): boolean {
  return getLevelPriority(level) >= getLevelPriority(minimum)
}

export function parseLogLevel(value: string | undefined, fallback: LogLevel): LogLevel {
  if (value === undefined) {
    return fallback
  }

  const normalised = value.toLowerCase()
  if (isLogLevel(normalised)) {
    return normalised
  }

  return fallback
}

export function isLogLevel(value: string): value is LogLevel {
  return value === 'debug' || value === 'info' || value === 'warn' || value === 'error'
}

function getLevelPriority(level: LogLevel): number {
  switch (level) {
    case 'debug':
      return 10
    case 'info':
      return 20
    case 'warn':
      return 30
    case 'error':
      return 40
    default:
      return 40
  }
}
