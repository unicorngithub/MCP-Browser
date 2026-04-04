import { contextBridge, ipcRenderer } from 'electron'
import type {
  CallToolResult,
  FetchToolsResult,
  MCPHttpHeader,
  MCPServer,
} from '../../shared/types'

/** 仅用于 electron-updater 模板组件的窄接口，不暴露完整 ipcRenderer */
contextBridge.exposeInMainWorld('updaterIpc', {
  invoke(channel: string, ...args: unknown[]) {
    return ipcRenderer.invoke(channel, ...args)
  },
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void) {
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
