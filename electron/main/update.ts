import { app, ipcMain, type BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import type { UpdateErrorUiKey } from '../../shared/types'

const { autoUpdater } = createRequire(import.meta.url)('electron-updater')

/** 主窗口：用于推送 update-available 等事件（与 invoke 的 event.sender 互补） */
let mainWindow: BrowserWindow | null = null

function sendToMainWindow(channel: string, ...args: unknown[]): void {
  const w = mainWindow
  if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
}

let autoUpdaterConfigured = false

function ensureAutoUpdaterOptions(): void {
  if (autoUpdaterConfigured) return
  autoUpdaterConfigured = true
  autoUpdater.autoDownload = false
  autoUpdater.disableWebInstaller = false
  autoUpdater.allowDowngrade = false
}

let globalListenersBound = false

function bindGlobalAutoUpdaterListeners(): void {
  if (globalListenersBound) return
  globalListenersBound = true
  ensureAutoUpdaterOptions()

  autoUpdater.on('checking-for-update', () => {})
  autoUpdater.on('update-available', (arg: UpdateInfo) => {
    sendToMainWindow('update-can-available', {
      update: true,
      version: app.getVersion(),
      newVersion: arg?.version,
    })
  })
  autoUpdater.on('update-not-available', (arg: UpdateInfo) => {
    sendToMainWindow('update-can-available', {
      update: false,
      version: app.getVersion(),
      newVersion: arg?.version,
    })
  })
}

let ipcHandlersRegistered = false

let downloadInProgress = false

function registerUpdateIpcOnce(): void {
  if (ipcHandlersRegistered) return
  ipcHandlersRegistered = true
  ensureAutoUpdaterOptions()
  bindGlobalAutoUpdaterListeners()

  ipcMain.handle('check-update', async () => {
    if (!app.isPackaged) {
      const error = new Error('The update feature is only available after the package.')
      return { message: error.message, error, uiKey: 'not_packaged' satisfies UpdateErrorUiKey }
    }
    try {
      return await autoUpdater.checkForUpdates()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      return { message: err.message, error: err, uiKey: 'network' satisfies UpdateErrorUiKey }
    }
  })

  ipcMain.handle('start-download', (event: Electron.IpcMainInvokeEvent) => {
    if (downloadInProgress) return

    downloadInProgress = true
    let cleaned = false

    const progressHandler = (info: ProgressInfo) => {
      event.sender.send('download-progress', info)
    }
    const errorHandler = (error: Error) => {
      cleanup()
      event.sender.send('update-error', {
        message: error.message,
        error,
        uiKey: 'download_failed' satisfies UpdateErrorUiKey,
      })
    }
    const downloadedHandler = () => {
      cleanup()
      event.sender.send('update-downloaded')
    }

    function cleanup(): void {
      if (cleaned) return
      cleaned = true
      downloadInProgress = false
      autoUpdater.removeListener('download-progress', progressHandler)
      autoUpdater.removeListener('error', errorHandler)
      autoUpdater.removeListener('update-downloaded', downloadedHandler)
    }

    autoUpdater.on('download-progress', progressHandler)
    autoUpdater.on('error', errorHandler)
    autoUpdater.on('update-downloaded', downloadedHandler)
    autoUpdater.downloadUpdate()
  })

  ipcMain.handle('quit-and-install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

/** 绑定自动更新：应在每个主窗口创建时调用以刷新推送目标；IPC 仅注册一次 */
export function update(win: BrowserWindow): void {
  mainWindow = win
  registerUpdateIpcOnce()
}
