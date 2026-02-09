/**
 * Shell Commands for File Operations
 *
 * Pure functions for building shell commands and parsing their output.
 * Used by the shell file service backend for BusyBox/dropbear devices
 * that don't support the SFTP subsystem.
 *
 * @module services/sftp/shell-commands
 */

import { posix as pathPosix } from 'node:path'
import type { SftpFileEntry, SftpFileType } from '../../types/contracts/v1/sftp.js'

/**
 * Escape a path for safe use in single-quoted shell arguments.
 *
 * Wraps the path in single quotes after escaping any embedded single quotes
 * using the standard `'\''` technique (end quote, escaped quote, start quote).
 *
 * SECURITY: This is critical for command injection prevention.
 * All user-supplied paths MUST pass through this function before being
 * interpolated into shell commands.
 */
export function escapeShellPath(path: string): string {
  const escaped = path.replace(/'/g, "'\\''")
  return `'${escaped}'`
}

/**
 * Build an `ls -la` command for listing directory contents.
 *
 * @param path - Absolute directory path (will be shell-escaped)
 * @param showHidden - If true, includes `-A` flag for dotfiles (excluding . and ..)
 * @returns Shell command string
 */
export function buildListCommand(path: string, showHidden: boolean): string {
  const flags = showHidden ? '-laA' : '-la'
  return `ls ${flags} ${escapeShellPath(path)}`
}

/**
 * Build an `ls -lad` command for stat-ing a single path.
 *
 * The `-d` flag prevents listing directory contents when the target is a dir.
 *
 * @param path - Absolute path to stat (will be shell-escaped)
 * @returns Shell command string
 */
export function buildStatCommand(path: string): string {
  return `ls -lad ${escapeShellPath(path)}`
}

/**
 * Build a command to resolve the user's home directory.
 *
 * Uses `echo ~` which is universally supported. The tilde is NOT quoted
 * because quoting prevents shell expansion.
 *
 * @returns Shell command string
 */
export function buildHomeCommand(): string {
  return 'echo ~'
}

/**
 * Parse the output of `echo ~` to get the home directory path.
 *
 * @param stdout - Raw stdout from the command
 * @returns Trimmed absolute home path
 */
export function resolveHomePath(stdout: string): string {
  return stdout.trim()
}

/**
 * Parse the output of `ls -la` into an array of file entries.
 *
 * Handles output from GNU coreutils, BusyBox, and macOS ls.
 * Skips the `total N` header line and `.`/`..` entries.
 *
 * @param stdout - Raw stdout from `ls -la`
 * @param basePath - The directory path being listed (for constructing full paths)
 * @returns Array of parsed file entries
 */
export function parseDirectoryListing(stdout: string, basePath: string): SftpFileEntry[] {
  const lines = stdout.split('\n')
  const entries: SftpFileEntry[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('total ')) {
      continue
    }

    const entry = parseLsLine(trimmed, basePath)
    if (entry === null) {
      continue
    }

    // Skip . and .. entries
    if (entry.name === '.' || entry.name === '..') {
      continue
    }

    entries.push(entry)
  }

  return entries
}

/**
 * Parse the output of `ls -lad` into a single file entry.
 *
 * @param stdout - Raw stdout from `ls -lad`
 * @param path - The path that was stat'd
 * @returns Parsed file entry, or null if parsing fails
 */
export function parseStatEntry(stdout: string, path: string): SftpFileEntry | null {
  const lines = stdout.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('total ')) {
      continue
    }

    const parentPath = pathPosix.dirname(path)
    const entry = parseLsLine(trimmed, parentPath)
    if (entry !== null) {
      // Override path and name: ls -lad shows the full path in output,
      // so the parsed name would be the full path instead of basename
      return { ...entry, path, name: pathPosix.basename(path) }
    }
  }

  return null
}

/**
 * Permission character positions for rwx mapping
 */
const PERMISSION_BITS = [
  0o400, 0o200, 0o100,  // owner: r, w, x
  0o040, 0o020, 0o010,  // group: r, w, x
  0o004, 0o002, 0o001   // other: r, w, x
] as const

/**
 * Parse a single line of `ls -l` output into a file entry.
 *
 * Expected format (GNU/BusyBox):
 *   drwxr-xr-x    2 root     root          4096 Jan  1 00:00 dirname
 *   -rw-r--r--    1 user     group         1234 Dec 31  2023 file.txt
 *   lrwxrwxrwx    1 user     group           12 Jan  1 00:00 link -> target
 *
 * The function is lenient with column spacing to handle both GNU coreutils
 * (which aligns columns) and BusyBox (which may use different spacing).
 *
 * @param line - Single line of ls -l output
 * @param basePath - Parent directory path
 * @returns Parsed file entry, or null if the line can't be parsed
 */
export function parseLsLine(line: string, basePath: string): SftpFileEntry | null {
  // Split on whitespace, limiting to 9 parts so the filename (which may contain spaces) stays intact
  // Format: permissions links owner group size month day time/year name
  const parts = line.split(/\s+/)
  if (parts.length < 9) {
    return null
  }

  const permString = parts[0]
  if (permString === undefined || permString.length < 10) {
    return null
  }

  // Extract fields
  const owner = parts[2] ?? 'unknown'
  const group = parts[3] ?? 'unknown'
  const sizeStr = parts[4]
  const monthStr = parts[5]
  const dayStr = parts[6]
  const timeOrYear = parts[7]

  if (sizeStr === undefined || monthStr === undefined || dayStr === undefined || timeOrYear === undefined) {
    return null
  }

  // The filename is everything after the 8th column
  // Rejoin in case the filename contains spaces
  const nameStartIndex = findNameStartIndex(line, parts)
  if (nameStartIndex === -1) {
    return null
  }

  let name = line.slice(nameStartIndex)

  // Handle symlinks: "name -> target"
  const symlinkIndex = name.indexOf(' -> ')
  if (symlinkIndex !== -1) {
    name = name.slice(0, symlinkIndex)
  }

  // Determine file type from first character
  const type = getFileTypeFromChar(permString.charAt(0))

  // Parse permission string to octal
  const permissionsOctal = parsePermissionString(permString)

  // Parse the rwx portion (characters 1-9)
  const permissions = permString.slice(1, 10)

  // Parse size
  const size = parseInt(sizeStr, 10)

  // Parse modification time
  const modifiedAt = parseLsDate(monthStr, dayStr, timeOrYear)

  const fullPath = basePath === '/' || basePath === '.'
    ? `/${name}`
    : `${basePath}/${name}`

  return {
    name,
    path: fullPath,
    type,
    size: Number.isNaN(size) ? 0 : size,
    permissions,
    permissionsOctal,
    owner,
    group,
    modifiedAt,
    accessedAt: modifiedAt, // ls doesn't provide access time
    isHidden: name.startsWith('.')
  }
}

/**
 * Find the character index where the filename starts in an ls -l line.
 *
 * The filename follows the 8th whitespace-separated field (time/year).
 * We find this by walking through the parts and tracking positions.
 */
function findNameStartIndex(line: string, parts: string[]): number {
  // We need to skip exactly 8 fields: perms, links, owner, group, size, month, day, time/year
  let pos = 0
  for (let fieldIdx = 0; fieldIdx < 8; fieldIdx++) {
    const part = parts.at(fieldIdx)
    if (part === undefined) {
      return -1
    }

    // Skip leading whitespace
    while (pos < line.length && line.charAt(pos) === ' ') {
      pos++
    }

    // Skip the field itself
    pos += part.length
  }

  // Skip whitespace after the last field
  while (pos < line.length && line.charAt(pos) === ' ') {
    pos++
  }

  return pos < line.length ? pos : -1
}

/**
 * Map the first character of ls -l permissions to SftpFileType
 */
function getFileTypeFromChar(char: string): SftpFileType {
  switch (char) {
    case 'd':
      return 'directory'
    case 'l':
      return 'symlink'
    case '-':
      return 'file'
    default:
      return 'other'
  }
}

/**
 * Parse an rwx permission string (e.g., "rwxr-xr-x") to octal.
 *
 * The input is the full 10-character string from ls (e.g., "drwxr-xr-x").
 * Characters 1-9 represent the permission bits.
 */
export function parsePermissionString(permString: string): number {
  let octal = 0

  for (let i = 0; i < PERMISSION_BITS.length; i++) {
    const char = permString.charAt(i + 1) // skip the type character
    const bit = PERMISSION_BITS.at(i)
    if (char !== '-' && bit !== undefined) {
      octal |= bit
    }
  }

  return octal
}

/**
 * Parse a date from ls -l output.
 *
 * ls produces two formats:
 * - "Jan  1 00:00" (recent files, within ~6 months)
 * - "Jan  1  2023" (older files, shows year instead of time)
 *
 * @returns ISO 8601 date string
 */
export function parseLsDate(month: string, day: string, timeOrYear: string): string {
  const monthIndex = MONTH_MAP.get(month.toLowerCase())
  if (monthIndex === undefined) {
    return new Date(0).toISOString()
  }

  const dayNum = parseInt(day, 10)
  if (Number.isNaN(dayNum)) {
    return new Date(0).toISOString()
  }

  // Check if timeOrYear is a time (HH:MM) or a year
  if (timeOrYear.includes(':')) {
    // Recent file: use current year
    const [hours, minutes] = timeOrYear.split(':')
    const now = new Date()
    const date = new Date(now.getFullYear(), monthIndex, dayNum,
      parseInt(hours ?? '0', 10), parseInt(minutes ?? '0', 10))

    // If the date is in the future, it's from last year
    if (date.getTime() > now.getTime()) {
      date.setFullYear(date.getFullYear() - 1)
    }

    return date.toISOString()
  }

  // Older file: timeOrYear is the year
  const year = parseInt(timeOrYear, 10)
  if (Number.isNaN(year)) {
    return new Date(0).toISOString()
  }

  return new Date(year, monthIndex, dayNum).toISOString()
}

/**
 * Month name to 0-based index mapping
 */
const MONTH_MAP = new Map<string, number>([
  ['jan', 0], ['feb', 1], ['mar', 2], ['apr', 3],
  ['may', 4], ['jun', 5], ['jul', 6], ['aug', 7],
  ['sep', 8], ['oct', 9], ['nov', 10], ['dec', 11]
])
