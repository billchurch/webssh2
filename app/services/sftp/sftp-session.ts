/**
 * SFTP Session Management
 *
 * Manages SFTP sessions that are opened on top of SSH connections.
 * Each SSH connection can have one SFTP subsystem session.
 *
 * @module services/sftp/sftp-session
 */

import type { SFTPWrapper, Stats, FileEntry as SSH2FileEntry } from 'ssh2'
import type { ConnectionId, SessionId } from '../../types/branded.js'
import type { Result } from '../../types/result.js'
import type { SftpFileEntry, SftpFileType } from '../../types/contracts/v1/sftp.js'
import { ok, err } from '../../utils/result.js'
import { SFTP_DEFAULTS, SFTP_LIMITS } from '../../constants/sftp.js'
import debug from 'debug'

const logger = debug('webssh2:services:sftp:session')

/**
 * SFTP session error
 */
export interface SftpSessionError {
  readonly code: 'SESSION_ERROR' | 'NOT_FOUND' | 'PERMISSION_DENIED' | 'TIMEOUT' | 'OPERATION_FAILED'
  readonly message: string
  readonly path?: string | undefined
  readonly originalError?: Error | undefined
}

/**
 * Configuration for SFTP operation wrapper
 */
interface SftpOperationConfig<T, R> {
  readonly session: SftpSession
  readonly timeout: number
  readonly timeoutMessage: string
  readonly failureMessage: string
  readonly path?: string
  readonly execute: (
    callback: (error: Error | null | undefined, result: T) => void
  ) => void
  readonly onSuccess: (result: T) => Result<R, SftpSessionError>
}

/**
 * Generic wrapper for SFTP callback-based operations
 *
 * Handles timeout, error mapping, and lastActivity updates consistently.
 */
function wrapSftpOperation<T, R>(
  config: SftpOperationConfig<T, R>
): Promise<Result<R, SftpSessionError>> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(err({
        code: 'TIMEOUT',
        message: config.timeoutMessage,
        path: config.path
      }))
    }, config.timeout)

    try {
      config.execute((error: Error | null | undefined, result: T) => {
        clearTimeout(timeoutId)
        config.session.lastActivity = Date.now()

        if (error !== undefined && error !== null) {
          resolve(err(mapSftpError(error, config.path)))
          return
        }

        resolve(config.onSuccess(result))
      })
    } catch (error) {
      clearTimeout(timeoutId)
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      resolve(err({
        code: 'OPERATION_FAILED',
        message: `${config.failureMessage}: ${errMsg}`,
        path: config.path,
        originalError: error instanceof Error ? error : undefined
      }))
    }
  })
}

/**
 * SFTP session state
 */
export interface SftpSession {
  readonly id: string
  readonly connectionId: ConnectionId
  readonly sessionId: SessionId
  readonly sftp: SFTPWrapper
  readonly createdAt: number
  lastActivity: number
}

/**
 * Options for opening an SFTP session
 */
export interface OpenSessionOptions {
  readonly timeout?: number
}

/**
 * Options for listing a directory
 */
export interface ListDirectoryOptions {
  readonly showHidden?: boolean
}

/**
 * SFTP Session Manager
 *
 * Wraps the ssh2 SFTPWrapper with higher-level operations
 * and error handling.
 */
export class SftpSessionManager {
  private readonly sessions = new Map<ConnectionId, SftpSession>()
  private readonly timeout: number

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout ?? SFTP_DEFAULTS.TIMEOUT
  }

  /**
   * Open an SFTP session on an SSH connection
   */
  openSession(
    connectionId: ConnectionId,
    sessionId: SessionId,
    sshClient: { sftp(callback: (err: Error | undefined, sftp: SFTPWrapper) => void): void },
    options?: OpenSessionOptions
  ): Promise<Result<SftpSession, SftpSessionError>> {
    return new Promise((resolve) => {
      const timeout = options?.timeout ?? this.timeout

      // Check if we already have a session for this connection
      const existing = this.sessions.get(connectionId)
      if (existing !== undefined) {
        existing.lastActivity = Date.now()
        resolve(ok(existing))
        return
      }

      // Set up timeout
      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'SFTP session open timeout'
        }))
      }, timeout)

      try {
        sshClient.sftp((error: Error | undefined, sftp: SFTPWrapper) => {
          clearTimeout(timeoutId)

          if (error !== undefined) {
            logger('Failed to open SFTP session:', error.message)
            resolve(err({
              code: 'SESSION_ERROR',
              message: `Failed to open SFTP session: ${error.message}`,
              originalError: error
            }))
            return
          }

          const now = Date.now()
          const session: SftpSession = {
            id: `sftp-${connectionId}-${now}`,
            connectionId,
            sessionId,
            sftp,
            createdAt: now,
            lastActivity: now
          }

          this.sessions.set(connectionId, session)
          logger('SFTP session opened:', session.id)
          resolve(ok(session))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'SESSION_ERROR',
          message: `SFTP session error: ${errMsg}`,
          originalError: error instanceof Error ? error : undefined
        }))
      }
    })
  }

  /**
   * Get an existing SFTP session
   */
  getSession(connectionId: ConnectionId): SftpSession | undefined {
    const session = this.sessions.get(connectionId)
    if (session !== undefined) {
      session.lastActivity = Date.now()
    }
    return session
  }

  /**
   * Close an SFTP session
   */
  closeSession(connectionId: ConnectionId): void {
    const session = this.sessions.get(connectionId)
    if (session !== undefined) {
      try {
        session.sftp.end()
      } catch (error) {
        logger('Error closing SFTP session:', error)
      }
      this.sessions.delete(connectionId)
      logger('SFTP session closed:', session.id)
    }
  }

  /**
   * List directory contents
   */
  listDirectory(
    session: SftpSession,
    path: string,
    options?: ListDirectoryOptions
  ): Promise<Result<SftpFileEntry[], SftpSessionError>> {
    const showHidden = options?.showHidden ?? false

    return wrapSftpOperation<SSH2FileEntry[], SftpFileEntry[]>({
      session,
      timeout: this.timeout,
      timeoutMessage: 'Directory listing timeout',
      failureMessage: 'Failed to list directory',
      path,
      execute: (callback) => session.sftp.readdir(path, callback),
      onSuccess: (list) => {
        const limitedList = list.slice(0, SFTP_LIMITS.MAX_DIRECTORY_ENTRIES)
        const filteredList = showHidden
          ? limitedList
          : limitedList.filter(entry => !entry.filename.startsWith('.'))
        const entries = filteredList.map(entry => transformFileEntry(entry, path))
        return ok(entries)
      }
    })
  }

  /**
   * Get file/directory stats
   */
  stat(session: SftpSession, path: string): Promise<Result<SftpFileEntry, SftpSessionError>> {
    return wrapSftpOperation<Stats, SftpFileEntry>({
      session,
      timeout: this.timeout,
      timeoutMessage: 'Stat operation timeout',
      failureMessage: 'Failed to stat',
      path,
      execute: (callback) => session.sftp.stat(path, callback),
      onSuccess: (stats) => ok(transformStats(path, stats))
    })
  }

  /**
   * Create a directory
   */
  mkdir(
    session: SftpSession,
    path: string,
    mode?: number
  ): Promise<Result<void, SftpSessionError>> {
    const attrs = mode === undefined ? {} : { mode }

    return wrapSftpOperation<void, void>({
      session,
      timeout: this.timeout,
      timeoutMessage: 'Mkdir operation timeout',
      failureMessage: 'Failed to create directory',
      path,
      execute: (callback) => session.sftp.mkdir(path, attrs, callback),
      onSuccess: () => ok(undefined)
    })
  }

  /**
   * Remove a file
   */
  unlink(session: SftpSession, path: string): Promise<Result<void, SftpSessionError>> {
    return wrapSftpOperation<void, void>({
      session,
      timeout: this.timeout,
      timeoutMessage: 'Unlink operation timeout',
      failureMessage: 'Failed to delete file',
      path,
      execute: (callback) => session.sftp.unlink(path, callback),
      onSuccess: () => ok(undefined)
    })
  }

  /**
   * Remove a directory
   */
  rmdir(session: SftpSession, path: string): Promise<Result<void, SftpSessionError>> {
    return wrapSftpOperation<void, void>({
      session,
      timeout: this.timeout,
      timeoutMessage: 'Rmdir operation timeout',
      failureMessage: 'Failed to remove directory',
      path,
      execute: (callback) => session.sftp.rmdir(path, callback),
      onSuccess: () => ok(undefined)
    })
  }

  /**
   * Get real path (resolve symlinks, but NOT tilde expansion)
   *
   * Note: realpath does NOT expand ~ (tilde). Use expandTildePath for that.
   */
  realpath(session: SftpSession, path: string): Promise<Result<string, SftpSessionError>> {
    return wrapSftpOperation<string, string>({
      session,
      timeout: this.timeout,
      timeoutMessage: 'Realpath operation timeout',
      failureMessage: 'Failed to resolve path',
      path,
      execute: (callback) => session.sftp.realpath(path, callback),
      onSuccess: (resolvedPath) => ok(resolvedPath)
    })
  }

  /**
   * Expand tilde (~) paths to absolute paths
   *
   * Handles:
   * - ~ -> home directory
   * - ~/path -> home directory + /path
   *
   * Uses realpath('.') to get the current directory, which for SFTP sessions
   * is typically the user's home directory.
   */
  expandTildePath(session: SftpSession, path: string): Promise<Result<string, SftpSessionError>> {
    // If path doesn't start with ~, just return it as-is
    if (path !== '~' && !path.startsWith('~/')) {
      return Promise.resolve(ok(path))
    }

    logger('Calling realpath(".") for tilde expansion, session: %s', session.id)

    return wrapSftpOperation<string, string>({
      session,
      timeout: this.timeout,
      timeoutMessage: 'Expand path timeout',
      failureMessage: 'Failed to expand path',
      path,
      execute: (callback) => session.sftp.realpath('.', callback),
      onSuccess: (homeDir) => {
        logger('realpath(".") returned homeDir: %s', homeDir)
        let expandedPath: string
        if (path === '~') {
          expandedPath = homeDir
        } else {
          const normalizedHome = homeDir.endsWith('/') ? homeDir : `${homeDir}/`
          expandedPath = `${normalizedHome}${path.slice(2)}`
        }
        logger('Expanded tilde path: %s -> %s', path, expandedPath)
        return ok(expandedPath)
      }
    })
  }

  /**
   * Close all sessions
   */
  closeAll(): void {
    for (const connectionId of this.sessions.keys()) {
      this.closeSession(connectionId)
    }
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size
  }
}

/**
 * Map ssh2 error to our error type
 */
function mapSftpError(error: Error, path?: string): SftpSessionError {
  const message = error.message.toLowerCase()

  if (message.includes('no such file') || message.includes('not found')) {
    return {
      code: 'NOT_FOUND',
      message: 'File or directory not found',
      path,
      originalError: error
    }
  }

  if (message.includes('permission denied') || message.includes('access denied')) {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Permission denied',
      path,
      originalError: error
    }
  }

  return {
    code: 'OPERATION_FAILED',
    message: error.message,
    path,
    originalError: error
  }
}

/**
 * Transform ssh2 FileEntry to our format
 */
function transformFileEntry(entry: SSH2FileEntry, basePath: string): SftpFileEntry {
  const attrs = entry.attrs
  const fullPath = basePath === '/' || basePath === '.'
    ? `/${entry.filename}`
    : `${basePath}/${entry.filename}`

  return {
    name: entry.filename,
    path: fullPath,
    type: getFileType(attrs.mode),
    size: attrs.size,
    permissions: formatPermissions(attrs.mode),
    permissionsOctal: attrs.mode & 0o777,
    owner: String(attrs.uid),
    group: String(attrs.gid),
    modifiedAt: new Date(attrs.mtime * 1000).toISOString(),
    accessedAt: new Date(attrs.atime * 1000).toISOString(),
    isHidden: entry.filename.startsWith('.')
  }
}

/**
 * Transform stats to file entry
 */
function transformStats(path: string, stats: Stats): SftpFileEntry {
  const parts = path.split('/')
  const name = parts.at(-1) ?? path

  return {
    name,
    path,
    type: getFileType(stats.mode),
    size: stats.size,
    permissions: formatPermissions(stats.mode),
    permissionsOctal: stats.mode & 0o777,
    owner: String(stats.uid),
    group: String(stats.gid),
    modifiedAt: new Date(stats.mtime * 1000).toISOString(),
    accessedAt: new Date(stats.atime * 1000).toISOString(),
    isHidden: name.startsWith('.')
  }
}

/**
 * Get file type from mode
 */
function getFileType(mode: number): SftpFileType {
  const type = mode & 0o170000

  switch (type) {
    case 0o040000:
      return 'directory'
    case 0o100000:
      return 'file'
    case 0o120000:
      return 'symlink'
    default:
      return 'other'
  }
}

/**
 * Format permissions as rwx string
 */
function formatPermissions(mode: number): string {
  const perms = mode & 0o777
  let result = ''

  // Owner
  result += (perms & 0o400) === 0 ? '-' : 'r'
  result += (perms & 0o200) === 0 ? '-' : 'w'
  result += (perms & 0o100) === 0 ? '-' : 'x'

  // Group
  result += (perms & 0o040) === 0 ? '-' : 'r'
  result += (perms & 0o020) === 0 ? '-' : 'w'
  result += (perms & 0o010) === 0 ? '-' : 'x'

  // Other
  result += (perms & 0o004) === 0 ? '-' : 'r'
  result += (perms & 0o002) === 0 ? '-' : 'w'
  result += (perms & 0o001) === 0 ? '-' : 'x'

  return result
}

/**
 * Create a new session manager
 */
export function createSftpSessionManager(options?: { timeout?: number }): SftpSessionManager {
  return new SftpSessionManager(options)
}
