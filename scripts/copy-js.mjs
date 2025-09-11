#!/usr/bin/env node
import { mkdirSync, existsSync, cpSync } from 'node:fs'
import { globSync } from 'glob'
import { dirname, join } from 'node:path'

let files = ['index.js', ...globSync('app/**/*.js', { dot: false, nodir: true })]

// PR18 flip: do not overwrite compiled TS mirrors for socket/routes
files = files.filter((p) => !/^(?:app\/)?socket\.js$/.test(p))
files = files.filter((p) => !/^(?:app\/)?routes\.js$/.test(p))
// PR20 flip: errors/logger now built from TS
files = files.filter((p) => !/^(?:app\/)?errors\.js$/.test(p))
files = files.filter((p) => !/^(?:app\/)?logger\.js$/.test(p))

for (const f of files) {
  const dest = join('dist', f)
  const dir = dirname(dest)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  cpSync(f, dest)
}
console.log(`Copied ${files.length} JS files to dist/`)
