#!/usr/bin/env node
import { mkdirSync, existsSync, cpSync } from 'node:fs'
import { globSync } from 'glob'
import { dirname, join } from 'node:path'

const files = [
  'index.js',
  ...globSync('app/**/*.js', { dot: false, nodir: true }),
]

for (const f of files) {
  const dest = join('dist', f)
  const dir = dirname(dest)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  cpSync(f, dest)
}
console.log(`Copied ${files.length} JS files to dist/`)

