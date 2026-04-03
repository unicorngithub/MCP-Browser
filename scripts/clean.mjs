import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const dirs = ['dist', 'dist-electron', 'release', path.join('node_modules', '.vite')]
for (const rel of dirs) {
  try {
    rmSync(path.join(root, rel), { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}
console.log('clean: removed', dirs.join(', '))
