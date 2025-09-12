#!/usr/bin/env node
import { mkdirSync, existsSync, cpSync } from 'node:fs'
import { globSync } from 'glob'
import { dirname, join } from 'node:path'

let files = [...globSync('app/**/*.js', { dot: false, nodir: true })]
// Exclude JS files that now have TS implementations to avoid overwriting
const EXCLUDE = new Set([
  'app/app.js',
  'app/socket.js',
  'app/client-path.js',
  'app/crypto-utils.js',
  'app/errors.js',
  'app/logger.js',
])
files = files.filter((p) => !EXCLUDE.has(p))

for (const f of files) {
  const dest = join('dist', f)
  const dir = dirname(dest)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  cpSync(f, dest)
}

console.log(`Copied ${files.length} JS files to dist/`)
