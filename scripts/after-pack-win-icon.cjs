/**
 * `signAndEditExecutable: false` 时主进程不会调用 app-builder 的 rcedit（否则会拉 winCodeSign 解压，需 symlink 权限）。
 * 此处直接调用 node_modules/rcedit 自带的 rcedit-x64.exe，并与 WinPackager.signAndEditResources 一样写入版本字符串 + 图标，
 * 避免仅写图标时部分环境下仍显示 Electron 默认图标。
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

module.exports = async function afterPackWinIcon(context) {
  if (context.electronPlatformName !== 'win32') return

  const repoRoot = path.join(__dirname, '..')
  const iconPath = path.resolve(repoRoot, 'build', 'icon.ico')
  if (!fs.existsSync(iconPath)) {
    console.warn('[after-pack-win-icon] Missing build/icon.ico, skip')
    return
  }

  const appInfo = context.packager.appInfo
  const name = appInfo.productFilename
  const exe = path.resolve(context.appOutDir, `${name}.exe`)
  if (!fs.existsSync(exe)) {
    console.warn('[after-pack-win-icon] Exe not found:', exe)
    return
  }

  const rceditBin = path.join(repoRoot, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe')
  if (!fs.existsSync(rceditBin)) {
    throw new Error(`[after-pack-win-icon] Missing ${rceditBin} (pnpm i 是否完整？)`)
  }

  const fileVer = appInfo.shortVersion || appInfo.buildVersion || '0.0.0'
  let productVer = fileVer
  try {
    if (typeof appInfo.getVersionInWeirdWindowsForm === 'function') {
      productVer = appInfo.shortVersionWindows || appInfo.getVersionInWeirdWindowsForm()
    }
  } catch {
    /* 忽略 */
  }

  const internal = path.basename(name, '.exe')

  const args = [
    exe,
    '--set-version-string',
    'FileDescription',
    appInfo.productName,
    '--set-version-string',
    'ProductName',
    appInfo.productName,
    '--set-version-string',
    'LegalCopyright',
    appInfo.copyright || '',
    '--set-file-version',
    fileVer,
    '--set-product-version',
    productVer,
    '--set-version-string',
    'InternalName',
    internal,
    '--set-version-string',
    'OriginalFilename',
    '',
    '--set-icon',
    iconPath,
  ]

  execFileSync(rceditBin, args, { stdio: 'inherit' })
  console.log('[after-pack-win-icon] Patched exe resources (icon + version info):', exe)
}
