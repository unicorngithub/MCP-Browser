/**
 * 将 package.json 的 version 设为 Git tag 对应的 semver（去掉前导 v）。
 * - CI：依赖环境变量 GITHUB_REF_NAME（Actions 在 tag 推送时为 v0.1.0）
 * - 本地：node scripts/sync-version-from-tag.mjs v0.1.0
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = path.join(root, 'package.json')

const raw = process.env.GITHUB_REF_NAME?.trim() || process.argv[2]?.trim()
if (!raw) {
  console.error(
    'sync-version-from-tag: 请设置 GITHUB_REF_NAME，或传入 tag，例如：node scripts/sync-version-from-tag.mjs v0.1.0',
  )
  process.exit(1)
}

const version = raw.startsWith('v') ? raw.slice(1) : raw
if (!version) {
  console.error('sync-version-from-tag: 空版本')
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.version = version
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`sync-version-from-tag: package.json version -> ${version}`)
