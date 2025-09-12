#!/usr/bin/env node
import { mkdirSync, existsSync, cpSync } from 'node:fs'
import { globSync } from 'glob'
import { dirname, join } from 'node:path'

let files = ['index.js', ...globSync('app/**/*.js', { dot: false, nodir: true })]

// PR18 flip: do not overwrite compiled TS mirrors for socket/routes
// Exclude these from 1:1 copy; we copy them under special names below
const ROUTES_SRC = 'app/routes.js'
const SOCKET_SRC = 'app/socket.js'
const CONNECTION_HANDLER_SRC = 'app/connectionHandler.js'
const IO_SRC = 'app/io.js'
files = files.filter((p) => p !== ROUTES_SRC)
files = files.filter((p) => p !== SOCKET_SRC)
// PR22 flip: connectionHandler/io now built from TS
files = files.filter((p) => p !== CONNECTION_HANDLER_SRC)
files = files.filter((p) => p !== IO_SRC)
// PR20 flip: errors/logger now built from TS
files = files.filter((p) => !/^(?:app\/)?errors\.js$/.test(p))
files = files.filter((p) => !/^(?:app\/)?logger\.js$/.test(p))

for (const f of files) {
  const dest = join('dist', f)
  const dir = dirname(dest)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  cpSync(f, dest)
}

// Special-case copies to avoid circular deps with TS mirrors.
// Copy original runtime implementations under distinct names used by *.impl.js shims.
const special = [
  [ROUTES_SRC, 'dist/app/routes.impl.target.js'],
  [SOCKET_SRC, 'dist/app/socket.impl.target.js'],
  [CONNECTION_HANDLER_SRC, 'dist/app/connectionHandler.impl.target.js'],
  [IO_SRC, 'dist/app/io.impl.target.js'],
]
for (const [src, dest] of special) {
  if (existsSync(src)) {
    const dir = dirname(dest)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    cpSync(src, dest)
  }
}

console.log(
  `Copied ${files.length} JS files to dist/ (plus special targets for routes/socket/connectionHandler/io)`
)
