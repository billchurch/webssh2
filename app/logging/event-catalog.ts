// app/logging/event-catalog.ts
// Central catalogue of structured logging event identifiers

export const LOG_EVENT_NAMES = [
  'auth_attempt',
  'auth_success',
  'auth_failure',
  'connection_failure',
  'session_init',
  'session_start',
  'session_end',
  'ssh_command',
  'pty_resize',
  'idle_timeout',
  'policy_block',
  'error',
  'credential_replay',
  // SFTP events
  'sftp_list',
  'sftp_stat',
  'sftp_mkdir',
  'sftp_delete',
  'sftp_upload_start',
  'sftp_upload_chunk',
  'sftp_upload_complete',
  'sftp_upload_cancel',
  'sftp_download_start',
  'sftp_download_chunk',
  'sftp_download_complete',
  'sftp_download_cancel',
  // Prompt events
  'prompt_sent',
  'prompt_response',
  'prompt_timeout',
  'prompt_error'
] as const

export type LogEventName = typeof LOG_EVENT_NAMES[number]

const EVENT_NAME_SET = new Set<string>(LOG_EVENT_NAMES)

export function isLogEventName(candidate: string): candidate is LogEventName {
  return EVENT_NAME_SET.has(candidate)
}
