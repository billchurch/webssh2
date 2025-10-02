import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { err, isErr, ok } from '../../app/utils/result.js'
import type { Result } from '../../app/types/result.js'

type DirectoryHashInput = {
  readonly basePath: string
  readonly directory: string
}

export async function hashDirectory(input: DirectoryHashInput): Promise<Result<string, Error>> {
  const fileList = await listFiles(input.directory, input.basePath)
  if (isErr(fileList)) {
    return fileList
  }

  const hash = createHash('sha256')
  for (const relativePath of fileList.value) {
    const absolutePath = join(input.basePath, relativePath)
    try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- absolutePath remains within basePath computed from build output
    const contents = await readFile(absolutePath)
      hash.update(relativePath)
      hash.update('\u0000')
      hash.update(contents)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error'
      return err(new Error(`failed to hash file ${absolutePath}: ${message}`))
    }
  }

  return ok(hash.digest('hex'))
}

async function listFiles(directory: string, basePath: string): Promise<Result<readonly string[], Error>> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory comes from controlled release staging flow
    const entries = await readdir(directory, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        const nested = await listFiles(entryPath, basePath)
        if (isErr(nested)) {
          return nested
        }

        files.push(...nested.value)
      } else if (entry.isFile()) {
        files.push(relative(basePath, entryPath))
      }
    }

    files.sort((first, second) => first.localeCompare(second))
    return ok(files)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to enumerate files for ${directory}: ${message}`))
  }
}
