// app/logging/event-catalog.ts
// Central catalogue of structured logging event identifiers

export const LOG_EVENT_NAMES = [
  'auth_attempt',
  'auth_success',
  'auth_failure',
  'session_init',
  'session_start',
  'session_end',
  'ssh_command',
  'pty_resize',
  'idle_timeout',
  'policy_block',
  'error',
  'credential_replay'
] as const

export type LogEventName = typeof LOG_EVENT_NAMES[number]

const EVENT_NAME_SET = new Set<string>(LOG_EVENT_NAMES)

export function isLogEventName(candidate: string): candidate is LogEventName {
  return EVENT_NAME_SET.has(candidate)
}
