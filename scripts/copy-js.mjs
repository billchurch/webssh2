#!/usr/bin/env node
import { mkdirSync, existsSync, cpSync } from 'node:fs'
import { globSync } from 'glob'
import { dirname, join } from 'node:path'

let files = ['index.js', ...globSync('app/**/*.js', { dot: false, nodir: true })]

// PR18 flip: do not overwrite compiled TS mirrors for socket/routes
// Exclude these from 1:1 copy; we copy them under special names below
const SOCKET_SRC = 'app/socket.js'
const CLIENT_PATH_SRC = 'app/client-path.js'
const CRYPTO_UTILS_SRC = 'app/crypto-utils.js'
const APP_SRC = 'app/app.js'
files = files.filter((p) => p !== SOCKET_SRC)
// PR22 flip: connectionHandler/io now built from TS
// PR23 flip: ssh now built from TS entrypoint
// PR24 flip: validators/execSchema built from TS entrypoint
// PR25 flip: middleware/security-headers now built from TS entrypoint
// PR27 flip: helpers now built from TS
files = files.filter((p) => p !== CLIENT_PATH_SRC)
files = files.filter((p) => p !== CRYPTO_UTILS_SRC)
// PR29 flip: app entry now built from TS
files = files.filter((p) => p !== APP_SRC)
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
  [SOCKET_SRC, 'dist/app/socket.impl.target.js'],
  [CLIENT_PATH_SRC, 'dist/app/client-path.impl.target.js'],
  [CRYPTO_UTILS_SRC, 'dist/app/crypto-utils.impl.target.js'],
  [APP_SRC, 'dist/app/app.impl.target.js'],
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
