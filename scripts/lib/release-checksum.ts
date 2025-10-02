import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { err, ok } from '../../app/utils/result.js'
import type { Result } from '../../app/types/result.js'

export async function writeChecksum(tarballPath: string): Promise<Result<string, Error>> {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- tarballPath is generated within release staging directory
    const contents = await readFile(tarballPath)
    const hash = createHash('sha256')
    hash.update(contents)
    const digest = hash.digest('hex')
    const checksumPath = `${tarballPath}.sha256`
    const line = `${digest}  ${basename(tarballPath)}\n`
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- checksumPath shares the controlled tarball destination
    await writeFile(checksumPath, line, { encoding: 'utf8' })
    return ok(checksumPath)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error'
    return err(new Error(`failed to write checksum: ${message}`))
  }
}
