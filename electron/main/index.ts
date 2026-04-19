import { app, BrowserWindow, ipcMain } from 'electron'
import type { AppLanguage } from '../../shared/locale'
import type { ThemePreference } from '../../shared/theme'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { registerMcpIpc } from './ipcMcp'
import { installAppMenu, syncNativeThemeSource } from './appMenu'
import { openExternalUrlIfAllowed } from './openExternalPolicy'
import { getWindowModePreference, setWindowModePreference } from './windowModeStore'
import type { WindowModePreference } from '../../shared/windowMode'

registerMcpIpc()

ipcMain.handle('app:get-window-mode', (): WindowModePreference => getWindowModePreference())

ipcMain.handle('app:set-window-mode', (_evt, mode: unknown) => {
  if (mode !== 'single' && mode !== 'multi') return { ok: false as const }
  const m = mode as WindowModePreference
  setWindowModePreference(m)
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('app-menu:window-mode', m)
  }
  installAppMenu()
  return { ok: true as const }
})

ipcMain.on('app:theme-preference-changed', (_, pref: unknown) => {
  if (pref !== 'light' && pref !== 'dark' && pref !== 'system') return
  const p = pref as ThemePreference
  syncNativeThemeSource(p)
  installAppMenu(p)
})

ipcMain.on('app:language-changed', (_, lng: unknown) => {
  if (lng !== 'en' && lng !== 'zh-CN') return
  installAppMenu(undefined, lng as AppLanguage)
})

app.setName('MCP Browser')

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'MCP Browser',
    width: 1180,
    height: 720,
    minWidth: 880,
    minHeight: 520,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // 新窗口链接交给系统浏览器；https 任意，http 仅本机回环
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrlIfAllowed(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

app.whenReady().then(() => {
  installAppMenu()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
