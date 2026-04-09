import { contextBridge, ipcRenderer } from 'electron'
import type {
  CallToolResult,
  ExportServersJsonResult,
  FetchToolsResult,
  ImportServersJsonResult,
  MCPHttpHeader,
  MCPServer,
} from '../../shared/types'
import type { AppLanguage } from '../../shared/locale'
import type { ThemePreference } from '../../shared/theme'

/** 与 `electron/main/update.ts` 中 `ipcMain.handle` 名称一致 */
const UPDATER_INVOKE_CHANNELS = new Set<string>(['check-update', 'start-download', 'quit-and-install'])

/** 与 `electron/main/update.ts` 中 `webContents.send` / `event.sender.send` 频道一致 */
const UPDATER_ON_CHANNELS = new Set<string>([
  'update-can-available',
  'update-error',
  'download-progress',
  'update-downloaded',
])

/** 自动更新专用：禁止任意 channel 转发，避免与 mcp:* 等 IPC 混用 */
contextBridge.exposeInMainWorld('updaterIpc', {
  invoke(channel: string, ...args: unknown[]) {
    if (!UPDATER_INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`[updaterIpc] disallowed invoke channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void) {
    if (!UPDATER_ON_CHANNELS.has(channel)) {
      console.error(`[updaterIpc] disallowed on channel: ${channel}`)
      return () => {}
    }
    const wrapped = (_e: Electron.IpcRendererEvent, ...rest: unknown[]) =>
      listener(_e as unknown, ...rest)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
})

contextBridge.exposeInMainWorld('mcpDesktop', {
  getServers(): Promise<MCPServer[]> {
    return ipcRenderer.invoke('mcp:get-servers')
  },
  setServers(list: MCPServer[]): Promise<void> {
    return ipcRenderer.invoke('mcp:set-servers', list)
  },
  fetchToolsList(url: string, headers?: MCPHttpHeader[]): Promise<FetchToolsResult> {
    return ipcRenderer.invoke('mcp:fetch-tools', url, headers ?? [])
  },
  callTool(
    url: string,
    toolName: string,
    args: Record<string, unknown>,
    headers?: MCPHttpHeader[],
  ): Promise<CallToolResult> {
    return ipcRenderer.invoke('mcp:call-tool', url, toolName, args, headers ?? [])
  },
  exportServersJson(opts?: { redactHeaders?: boolean }): Promise<ExportServersJsonResult> {
    return ipcRenderer.invoke('mcp:export-servers-json', opts ?? {})
  },
  importServersJson(): Promise<ImportServersJsonResult> {
    return ipcRenderer.invoke('mcp:import-servers-json')
  },
  onServersBackupMenuAction(handler: (action: 'export' | 'import') => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, action: unknown) => {
      if (action === 'export' || action === 'import') handler(action)
    }
    ipcRenderer.on('mcp-menu:servers-backup', wrap)
    return () => ipcRenderer.removeListener('mcp-menu:servers-backup', wrap)
  },
})

contextBridge.exposeInMainWorld('appTheme', {
  notifyPreferenceChanged(pref: ThemePreference) {
    ipcRenderer.send('app:theme-preference-changed', pref)
  },
  onMenuSelect(handler: (pref: ThemePreference) => void): () => void {
    const wrap = (_e: Electron.IpcRendererEvent, pref: unknown) => {
      if (pref === 'light' || pref === 'dark' || pref === 'system') handler(pref)
    }
    ipcRenderer.on('app-menu:theme', wrap)
    return () => ipcRenderer.removeListener('app-menu:theme', wrap)
  },
})

contextBridge.exposeInMainWorld('appLocale', {
  notifyLanguageChanged(lng: AppLanguage) {
    if (lng === 'en' || lng === 'zh-CN') ipcRenderer.send('app:language-changed', lng)
  },
})

contextBridge.exposeInMainWorld('appShellMenu', {
  onCheckForUpdatesRequest(handler: () => void): () => void {
    const wrap = () => handler()
    ipcRenderer.on('app-menu:check-for-updates', wrap)
    return () => ipcRenderer.removeListener('app-menu:check-for-updates', wrap)
  },
})

function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise<void>(resolve => {
    if (condition.includes(document.readyState)) {
      resolve()
      return
    }
    document.addEventListener('readystatechange', () => {
      if (condition.includes(document.readyState)) resolve()
    })
  })
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find(e => e === child)) {
      parent.appendChild(child)
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find(e => e === child)) {
      parent.removeChild(child)
    }
  },
}

function useLoading() {
  const className = `loaders-css__square-spin`
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
`
  const oStyle = document.createElement('style')
  const oDiv = document.createElement('div')

  oStyle.id = 'app-loading-style'
  oStyle.innerHTML = styleContent
  oDiv.className = 'app-loading-wrap'
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle)
      safeDOM.append(document.body, oDiv)
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle)
      safeDOM.remove(document.body, oDiv)
    },
  }
}

const { appendLoading, removeLoading } = useLoading()
void domReady().then(appendLoading)

window.onmessage = (ev: MessageEvent<{ payload?: string }>) => {
  if (ev.data?.payload === 'removeLoading') removeLoading()
}

setTimeout(removeLoading, 4999)
