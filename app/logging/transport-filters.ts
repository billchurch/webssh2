// app/logging/transport-filters.ts
// Transport wrappers that apply additional filtering logic

import { shouldLog, type LogLevel } from './levels.js'
import type { LogTransport } from './stdout-transport.js'
import type { Result } from '../types/result.js'
import { ok, err } from '../utils/result.js'

interface ParsedLevelResult {
  readonly level: LogLevel
}

export function createLevelFilteredTransport(
  transport: LogTransport,
  minimumLevel: LogLevel
): LogTransport {
  return {
    publish: (payload) => {
      const parsed = parseLogLevel(payload)
      if (!parsed.ok) {
        return err(parsed.error)
      }

      if (!shouldLog(parsed.value.level, minimumLevel)) {
        return ok(undefined)
      }

      return transport.publish(payload)
    },
    flush: () => transport.flush()
  }
}

function parseLogLevel(payload: string): Result<ParsedLevelResult> {
  try {
    const parsed = JSON.parse(payload) as { level?: string }
    if (typeof parsed.level !== 'string') {
      return err(new Error('Structured log payload missing level'))
    }

    const level = parsed.level as LogLevel
    return ok({ level })
  } catch (error) {
    const failure = error instanceof Error ? error : new Error('Failed to parse structured log payload')
    return err(failure)
  }
}
