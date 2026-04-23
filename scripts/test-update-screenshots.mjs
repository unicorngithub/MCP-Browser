/**
 * 与 `pnpm test` 相同，但会设置 MCP_BROWSER_UPDATE_SCREENSHOTS=1，
 * 用于刷新 README 用图（docs/images）及 test/screenshots/e2e.png。
 */
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
process.env.MCP_BROWSER_UPDATE_SCREENSHOTS = '1'

let r = spawnSync('pnpm', ['run', 'build:test'], { cwd: root, stdio: 'inherit', shell: true })
if (r.status !== 0) process.exit(r.status ?? 1)
r = spawnSync('pnpm', ['test'], { cwd: root, stdio: 'inherit', shell: true })
if (r.status !== 0) process.exit(r.status ?? 1)
r = spawnSync('pnpm', ['run', 'test:e2e'], { cwd: root, stdio: 'inherit', shell: true })
process.exit(r.status ?? 0)
