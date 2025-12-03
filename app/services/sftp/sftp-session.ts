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
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'Directory listing timeout',
          path
        }))
      }, this.timeout)

      try {
        session.sftp.readdir(path, (error: Error | undefined, list: SSH2FileEntry[]) => {
          clearTimeout(timeoutId)
          session.lastActivity = Date.now()

          if (error !== undefined) {
            resolve(err(mapSftpError(error, path)))
            return
          }

          // Limit number of entries
          const limitedList = list.slice(0, SFTP_LIMITS.MAX_DIRECTORY_ENTRIES)

          // Filter hidden files if requested
          const showHidden = options?.showHidden ?? false
          const filteredList = showHidden
            ? limitedList
            : limitedList.filter(entry => !entry.filename.startsWith('.'))

          // Transform to our format
          const entries = filteredList.map(entry => transformFileEntry(entry, path))

          resolve(ok(entries))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'OPERATION_FAILED',
          message: `Failed to list directory: ${errMsg}`,
          path,
          originalError: error instanceof Error ? error : undefined
        }))
      }
    })
  }

  /**
   * Get file/directory stats
   */
  stat(session: SftpSession, path: string): Promise<Result<SftpFileEntry, SftpSessionError>> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'Stat operation timeout',
          path
        }))
      }, this.timeout)

      try {
        session.sftp.stat(path, (error: Error | undefined, stats: Stats) => {
          clearTimeout(timeoutId)
          session.lastActivity = Date.now()

          if (error !== undefined) {
            resolve(err(mapSftpError(error, path)))
            return
          }

          const entry = transformStats(path, stats)
          resolve(ok(entry))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'OPERATION_FAILED',
          message: `Failed to stat: ${errMsg}`,
          path,
          originalError: error instanceof Error ? error : undefined
        }))
      }
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
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'Mkdir operation timeout',
          path
        }))
      }, this.timeout)

      try {
        const attrs = mode === undefined ? {} : { mode }

        session.sftp.mkdir(path, attrs, (error: Error | null | undefined) => {
          clearTimeout(timeoutId)
          session.lastActivity = Date.now()

          if (error !== undefined && error !== null) {
            resolve(err(mapSftpError(error, path)))
            return
          }

          resolve(ok(undefined))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'OPERATION_FAILED',
          message: `Failed to create directory: ${errMsg}`,
          path,
          originalError: error instanceof Error ? error : undefined
        }))
      }
    })
  }

  /**
   * Remove a file
   */
  unlink(session: SftpSession, path: string): Promise<Result<void, SftpSessionError>> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'Unlink operation timeout',
          path
        }))
      }, this.timeout)

      try {
        session.sftp.unlink(path, (error: Error | null | undefined) => {
          clearTimeout(timeoutId)
          session.lastActivity = Date.now()

          if (error !== undefined && error !== null) {
            resolve(err(mapSftpError(error, path)))
            return
          }

          resolve(ok(undefined))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'OPERATION_FAILED',
          message: `Failed to delete file: ${errMsg}`,
          path,
          originalError: error instanceof Error ? error : undefined
        }))
      }
    })
  }

  /**
   * Remove a directory
   */
  rmdir(session: SftpSession, path: string): Promise<Result<void, SftpSessionError>> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'Rmdir operation timeout',
          path
        }))
      }, this.timeout)

      try {
        session.sftp.rmdir(path, (error: Error | null | undefined) => {
          clearTimeout(timeoutId)
          session.lastActivity = Date.now()

          if (error !== undefined && error !== null) {
            resolve(err(mapSftpError(error, path)))
            return
          }

          resolve(ok(undefined))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'OPERATION_FAILED',
          message: `Failed to remove directory: ${errMsg}`,
          path,
          originalError: error instanceof Error ? error : undefined
        }))
      }
    })
  }

  /**
   * Get real path (resolve symlinks, but NOT tilde expansion)
   *
   * Note: realpath does NOT expand ~ (tilde). Use expandTildePath for that.
   */
  realpath(session: SftpSession, path: string): Promise<Result<string, SftpSessionError>> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'Realpath operation timeout',
          path
        }))
      }, this.timeout)

      try {
        session.sftp.realpath(path, (error: Error | undefined, resolvedPath: string) => {
          clearTimeout(timeoutId)
          session.lastActivity = Date.now()

          if (error !== undefined) {
            resolve(err(mapSftpError(error, path)))
            return
          }

          resolve(ok(resolvedPath))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'OPERATION_FAILED',
          message: `Failed to resolve path: ${errMsg}`,
          path,
          originalError: error instanceof Error ? error : undefined
        }))
      }
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
    return new Promise((resolve) => {
      // If path doesn't start with ~, just return it as-is
      if (path !== '~' && !path.startsWith('~/')) {
        resolve(ok(path))
        return
      }

      const timeoutId = setTimeout(() => {
        resolve(err({
          code: 'TIMEOUT',
          message: 'Expand path timeout',
          path
        }))
      }, this.timeout)

      try {
        // Get the current directory (typically home directory for SFTP)
        logger('Calling realpath(".") for tilde expansion, session: %s', session.id)
        session.sftp.realpath('.', (error: Error | undefined, homeDir: string) => {
          logger('realpath(".") callback received, error: %s, homeDir: %s', error?.message, homeDir)
          clearTimeout(timeoutId)
          session.lastActivity = Date.now()

          if (error !== undefined) {
            resolve(err(mapSftpError(error, path)))
            return
          }

          // Replace ~ with the home directory
          let expandedPath: string
          if (path === '~') {
            expandedPath = homeDir
          } else {
            // path starts with ~/
            const subPath = path.slice(2) // Remove ~/
            expandedPath = homeDir.endsWith('/')
              ? `${homeDir}${subPath}`
              : `${homeDir}/${subPath}`
          }

          logger('Expanded tilde path: %s -> %s', path, expandedPath)
          resolve(ok(expandedPath))
        })
      } catch (error) {
        clearTimeout(timeoutId)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        resolve(err({
          code: 'OPERATION_FAILED',
          message: `Failed to expand path: ${errMsg}`,
          path,
          originalError: error instanceof Error ? error : undefined
        }))
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
