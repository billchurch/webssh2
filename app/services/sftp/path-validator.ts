/**
 * Path Validator for SFTP Operations
 *
 * Provides security validation for remote paths including:
 * - Path traversal prevention
 * - Allowed paths checking
 * - Extension blocking
 * - Path normalization
 *
 * @module services/sftp/path-validator
 */

import { posix as pathPosix } from 'node:path'
import { ok, err } from '../../utils/result.js'
import type { Result } from '../../types/result.js'
import { SFTP_LIMITS } from '../../constants/sftp.js'

/**
 * Path validation error
 */
export interface PathValidationError {
  readonly code: 'PATH_TRAVERSAL' | 'PATH_TOO_LONG' | 'PATH_FORBIDDEN' | 'EXTENSION_BLOCKED' | 'INVALID_PATH'
  readonly message: string
  readonly path: string
}

/**
 * Path validation options
 */
export interface PathValidationOptions {
  /** Paths that are allowed (null = allow all) */
  readonly allowedPaths: readonly string[] | null
  /** File extensions that are blocked */
  readonly blockedExtensions: readonly string[]
  /** Whether to check extensions (skip for directory operations) */
  readonly checkExtension?: boolean
}

/**
 * Validates a remote path for SFTP operations
 *
 * This is a pure function that performs security checks on paths:
 * 1. Null byte check (prevents path injection)
 * 2. Path length check
 * 3. Path normalization (resolves ../ and ./)
 * 4. Allowed paths check (if configured)
 * 5. Extension blocking (if configured and checkExtension is true)
 *
 * @param requestedPath - The path to validate
 * @param options - Validation options
 * @returns Result with normalized path or validation error
 */
export function validatePath(
  requestedPath: string,
  options: PathValidationOptions
): Result<string, PathValidationError> {
  // Check for null bytes (common injection attack)
  if (requestedPath.includes('\0')) {
    return err({
      code: 'INVALID_PATH',
      message: 'Path contains null bytes',
      path: requestedPath
    })
  }

  // Check path length
  if (requestedPath.length > SFTP_LIMITS.MAX_PATH_LENGTH) {
    return err({
      code: 'PATH_TOO_LONG',
      message: `Path exceeds maximum length of ${SFTP_LIMITS.MAX_PATH_LENGTH} characters`,
      path: requestedPath
    })
  }

  // Normalize the path using POSIX rules (remote paths are typically Unix-style)
  const normalized = normalizePath(requestedPath)

  // Check for path traversal attempts
  const traversalCheck = checkPathTraversal(normalized, requestedPath)
  if (!traversalCheck.ok) {
    return err(traversalCheck.error)
  }

  // Check against allowed paths
  const allowedCheck = checkAllowedPaths(normalized, options.allowedPaths)
  if (!allowedCheck.ok) {
    return err(allowedCheck.error)
  }

  // Check extension if requested
  if (options.checkExtension === true) {
    const extensionCheck = checkBlockedExtension(normalized, options.blockedExtensions)
    if (!extensionCheck.ok) {
      return err(extensionCheck.error)
    }
  }

  return ok(normalized)
}

/**
 * Normalize a path using POSIX rules
 *
 * Handles:
 * - Multiple slashes
 * - Relative components (./ and ../)
 * - Trailing slashes
 * - Home directory (~)
 */
export function normalizePath(inputPath: string): string {
  // Handle empty path
  if (inputPath === '' || inputPath === '.') {
    return '.'
  }

  // Preserve home directory expansion
  if (inputPath === '~' || inputPath === '~/') {
    return '~'
  }

  // Handle paths starting with ~
  if (inputPath.startsWith('~/')) {
    const rest = inputPath.slice(2)
    const normalizedRest = pathPosix.normalize(rest)
    // Avoid ~/. result
    if (normalizedRest === '.') {
      return '~'
    }
    return `~/${normalizedRest}`
  }

  // Standard normalization
  return pathPosix.normalize(inputPath)
}

/**
 * Check for path traversal attacks
 *
 * Detects attempts to escape the intended directory structure.
 */
function checkPathTraversal(
  normalizedPath: string,
  originalPath: string
): Result<void, PathValidationError> {
  // Check if normalization resulted in a parent directory escape
  // This happens when someone tries ../../../etc/passwd
  if (normalizedPath.startsWith('..')) {
    return err({
      code: 'PATH_TRAVERSAL',
      message: 'Path traversal attempt detected',
      path: originalPath
    })
  }

  // Check for null byte injection (already checked, but double-check normalized)
  if (normalizedPath.includes('\0')) {
    return err({
      code: 'INVALID_PATH',
      message: 'Invalid characters in path',
      path: originalPath
    })
  }

  return ok(undefined)
}

/**
 * Check if path is within allowed directories
 */
function checkAllowedPaths(
  normalizedPath: string,
  allowedPaths: readonly string[] | null
): Result<void, PathValidationError> {
  // If no allowed paths configured, allow all
  if (allowedPaths === null || allowedPaths.length === 0) {
    return ok(undefined)
  }

  // Special case: home directory is typically allowed if any path with ~ is allowed
  if (normalizedPath === '~' || normalizedPath.startsWith('~/')) {
    const hasHomePathAllowed = allowedPaths.some(p => p === '~' || p.startsWith('~/'))
    if (hasHomePathAllowed) {
      return ok(undefined)
    }
  }

  // Check if path starts with any allowed path
  for (const allowedPath of allowedPaths) {
    const normalizedAllowed = normalizePath(allowedPath)

    // Exact match
    if (normalizedPath === normalizedAllowed) {
      return ok(undefined)
    }

    // Subpath match (path is under allowed directory)
    if (normalizedPath.startsWith(`${normalizedAllowed}/`)) {
      return ok(undefined)
    }
  }

  return err({
    code: 'PATH_FORBIDDEN',
    message: 'Path not in allowed directories',
    path: normalizedPath
  })
}

/**
 * Check if file extension is blocked
 */
function checkBlockedExtension(
  normalizedPath: string,
  blockedExtensions: readonly string[]
): Result<void, PathValidationError> {
  if (blockedExtensions.length === 0) {
    return ok(undefined)
  }

  const fileName = pathPosix.basename(normalizedPath)
  const ext = pathPosix.extname(fileName).toLowerCase()

  // No extension
  if (ext === '') {
    return ok(undefined)
  }

  // Normalize blocked extensions to include leading dot
  // This allows users to specify either ".md" or "md"
  const normalizedBlocked = blockedExtensions.map(e => {
    const lower = e.toLowerCase()
    return lower.startsWith('.') ? lower : `.${lower}`
  })

  if (normalizedBlocked.includes(ext)) {
    return err({
      code: 'EXTENSION_BLOCKED',
      message: `File extension ${ext} is not allowed`,
      path: normalizedPath
    })
  }

  return ok(undefined)
}

/**
 * Validate a file name (not full path)
 */
export function validateFileName(fileName: string): Result<string, PathValidationError> {
  // Check for null bytes
  if (fileName.includes('\0')) {
    return err({
      code: 'INVALID_PATH',
      message: 'Filename contains invalid characters',
      path: fileName
    })
  }

  // Check length
  if (fileName.length > SFTP_LIMITS.MAX_FILENAME_LENGTH) {
    return err({
      code: 'PATH_TOO_LONG',
      message: `Filename exceeds maximum length of ${SFTP_LIMITS.MAX_FILENAME_LENGTH} characters`,
      path: fileName
    })
  }

  // Check for path separators (which shouldn't be in a filename)
  if (fileName.includes('/') || fileName.includes('\\')) {
    return err({
      code: 'INVALID_PATH',
      message: 'Filename cannot contain path separators',
      path: fileName
    })
  }

  // Check for reserved names
  if (fileName === '.' || fileName === '..') {
    return err({
      code: 'INVALID_PATH',
      message: 'Invalid filename',
      path: fileName
    })
  }

  return ok(fileName)
}

/**
 * Join paths safely
 *
 * Combines a base path with a relative path, ensuring the result
 * stays within the base path.
 */
export function joinPathSafely(
  basePath: string,
  relativePath: string
): Result<string, PathValidationError> {
  // Normalize both paths
  const normalizedBase = normalizePath(basePath)
  const normalizedRelative = normalizePath(relativePath)

  // Check if relative path tries to escape
  if (normalizedRelative.startsWith('/') || normalizedRelative.startsWith('..')) {
    return err({
      code: 'PATH_TRAVERSAL',
      message: 'Cannot use absolute or parent paths',
      path: relativePath
    })
  }

  // Join the paths
  const joined = pathPosix.join(normalizedBase, normalizedRelative)
  const normalizedJoined = normalizePath(joined)

  // Verify the result is still under the base path
  if (normalizedBase !== '.' && normalizedBase !== '~') {
    if (!normalizedJoined.startsWith(normalizedBase)) {
      return err({
        code: 'PATH_TRAVERSAL',
        message: 'Path escapes base directory',
        path: relativePath
      })
    }
  }

  return ok(normalizedJoined)
}
