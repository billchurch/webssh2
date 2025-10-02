import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const tsconfigPath = join(process.cwd(), 'tsconfig.build.json')

if (!existsSync(tsconfigPath)) {
  process.stdout.write('prestart: tsconfig.build.json not found, assuming prebuilt bundle; skipping build\n')
  process.exit(0)
}

const npmExec = process.env.npm_execpath
const spawnCommand = npmExec === undefined ? 'npm' : process.execPath
const spawnArgs = npmExec === undefined ? ['run', 'build'] : [npmExec, 'run', 'build']
const result = spawnSync(spawnCommand, spawnArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: npmExec === undefined
})

if (typeof result.status === 'number') {
  process.exit(result.status)
}

process.exit(1)
