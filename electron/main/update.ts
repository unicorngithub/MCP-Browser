import { app, ipcMain, type BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import type { UpdateErrorUiKey } from '../../shared/types'
import { shouldRunSilentUpdaterCheck } from '../../shared/updateSilentCheck'
import { getLastSilentUpdateCheckAt, setLastSilentUpdateCheckAt } from './updatePrefsStore'

const { autoUpdater } = createRequire(import.meta.url)('electron-updater')

/** 主窗口：用于推送 update-available 等事件（与 invoke 的 event.sender 互补） */
let mainWindow: BrowserWindow | null = null

/** 当前这次 `checkForUpdates` 是否为静默检查（渲染进程据此决定是否弹窗） */
let silentCheckActive = false

/** 用户在手动的「检查更新」流程中点了取消：无法真正中断 HTTP，但不再向渲染进程推送本次结果 */
let manualCheckUserCancelled = false

function sendToMainWindow(channel: string, ...args: unknown[]): void {
  const w = mainWindow
  if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
}

function logUpdaterException(context: string, error: unknown): void {
  const e = error instanceof Error ? error : new Error(String(error))
  console.error(`[autoUpdater:${context}]`, e.message, e.stack ?? '')
}

function attachUpdaterLogger(): void {
  const prefix = '[autoUpdater]'
  const logger = {
    info: (m: unknown) => console.log(prefix, m),
    warn: (m: unknown) => console.warn(prefix, m),
    error: (m: unknown) => console.error(prefix, m),
    debug: (m: unknown) => {
      if (process.env.MCP_BROWSER_UPDATER_DEBUG === '1' || process.env.MCP_BROWSER_UPDATER_DEBUG === 'true') {
        console.debug(prefix, m)
      }
    },
  }
  ;(autoUpdater as { logger?: typeof logger }).logger = logger
}

let autoUpdaterConfigured = false

function ensureAutoUpdaterOptions(): void {
  if (autoUpdaterConfigured) return
  autoUpdaterConfigured = true
  autoUpdater.autoDownload = false
  autoUpdater.disableWebInstaller = false
  autoUpdater.allowDowngrade = false
  attachUpdaterLogger()
}

let globalListenersBound = false

function bindGlobalAutoUpdaterListeners(): void {
  if (globalListenersBound) return
  globalListenersBound = true
  ensureAutoUpdaterOptions()

  autoUpdater.on('checking-for-update', () => {
    console.log('[autoUpdater] checking-for-update', silentCheckActive ? '(silent)' : '')
  })
  autoUpdater.on('update-available', (arg: UpdateInfo) => {
    if (!silentCheckActive && manualCheckUserCancelled) return
    sendToMainWindow('update-can-available', {
      update: true,
      version: app.getVersion(),
      newVersion: arg?.version,
      silentCheck: silentCheckActive,
    })
  })
  autoUpdater.on('update-not-available', (arg: UpdateInfo) => {
    if (!silentCheckActive && manualCheckUserCancelled) return
    sendToMainWindow('update-can-available', {
      update: false,
      version: app.getVersion(),
      newVersion: arg?.version,
      silentCheck: silentCheckActive,
    })
  })
  autoUpdater.on('error', (err: Error) => {
    logUpdaterException('event', err)
  })
}

let ipcHandlersRegistered = false

let downloadInProgress = false

let silentStartupCheckScheduled = false

const DEFAULT_SILENT_DELAY_MS = 8000

function scheduleSilentStartupCheckOnce(): void {
  if (silentStartupCheckScheduled) return
  if (!app.isPackaged) return
  if (process.env.MCP_BROWSER_SKIP_SILENT_UPDATE_CHECK === '1' || process.env.MCP_BROWSER_SKIP_SILENT_UPDATE_CHECK === 'true') {
    return
  }
  silentStartupCheckScheduled = true
  const raw = process.env.MCP_BROWSER_SILENT_UPDATE_DELAY_MS
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  const delayMs = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SILENT_DELAY_MS

  setTimeout(() => {
    void runSilentUpdateCheckIfDue()
  }, delayMs)
}

async function runSilentUpdateCheckIfDue(): Promise<void> {
  if (!app.isPackaged) return
  if (process.env.MCP_BROWSER_SKIP_SILENT_UPDATE_CHECK === '1' || process.env.MCP_BROWSER_SKIP_SILENT_UPDATE_CHECK === 'true') {
    return
  }
  const last = getLastSilentUpdateCheckAt()
  if (!shouldRunSilentUpdaterCheck(last, Date.now())) return

  ensureAutoUpdaterOptions()
  bindGlobalAutoUpdaterListeners()

  try {
    silentCheckActive = true
    await autoUpdater.checkForUpdates()
  } catch (error) {
    logUpdaterException('silent-check', error)
  } finally {
    silentCheckActive = false
    setLastSilentUpdateCheckAt(new Date().toISOString())
  }
}

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
    silentCheckActive = false
    manualCheckUserCancelled = false
    try {
      return await autoUpdater.checkForUpdates()
    } catch (error) {
      if (manualCheckUserCancelled) {
        return { cancelled: true as const }
      }
      const err = error instanceof Error ? error : new Error(String(error))
      logUpdaterException('check-update', err)
      return { message: err.message, error: err, uiKey: 'network' satisfies UpdateErrorUiKey }
    } finally {
      manualCheckUserCancelled = false
    }
  })

  ipcMain.handle('cancel-check-update', () => {
    if (!silentCheckActive) manualCheckUserCancelled = true
  })

  ipcMain.handle('start-download', (event: Electron.IpcMainInvokeEvent) => {
    if (downloadInProgress) return

    downloadInProgress = true
    let cleaned = false

    const progressHandler = (info: ProgressInfo) => {
      event.sender.send('download-progress', info)
    }
    const errorHandler = (error: Error) => {
      logUpdaterException('download', error)
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
  scheduleSilentStartupCheckOnce()
}
