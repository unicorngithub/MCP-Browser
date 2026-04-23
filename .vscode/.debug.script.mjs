import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'

const pkg = createRequire(import.meta.url)('../package.json')
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// write .debug.env
const envContent = Object.entries(pkg.debug.env).map(([key, val]) => `${key}=${val}`)
fs.writeFileSync(path.join(__dirname, '.debug.env'), envContent.join('\n'))

const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'dev'],
  {
    stdio: 'inherit',
    env: { ...process.env, VSCODE_DEBUG: 'true' },
  },
)

function shutdownChild() {
  if (child.exitCode !== null || child.signalCode !== null) return
  try {
    child.kill()
  } catch {
    /* ignore */
  }
}

/** VS Code 结束调试/终止 Background Task 时常发 SIGTERM；转发给 Vite 子进程，避免残留。 */
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, shutdownChild)
}
if (process.platform !== 'win32') {
  process.on('SIGHUP', shutdownChild)
}

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
