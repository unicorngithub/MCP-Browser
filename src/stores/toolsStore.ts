import { create } from 'zustand'
import type { McpConnectDiagnostics, MCPHttpHeader, MCPTool } from '@shared/types'

const REUSE_SESSION_LS_KEY = 'mcp-browser-reuse-mcp-session'

function loadReuseSessionPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(REUSE_SESSION_LS_KEY) === 'true'
  } catch {
    return false
  }
}

type ConnState = 'idle' | 'loading' | 'ok' | 'error'

interface ToolsState {
  tools: MCPTool[]
  connection: ConnState
  error: string | null
  connectDiagnostics: McpConnectDiagnostics | null
  lastUrl: string | null
  lastHeaders: MCPHttpHeader[] | undefined
  selectedToolName: string | null
  /** 为 true 时拉列表 / 调工具复用同一 MCP 会话（按端点缓存，带空闲超时） */
  reuseMcpSession: boolean
  setReuseMcpSession: (value: boolean) => void
  fetchForUrl: (url: string | null, headers?: MCPHttpHeader[]) => Promise<void>
  setSelectedTool: (name: string | null) => void
  clear: () => void
}

export const useToolsStore = create<ToolsState>((set, get) => ({
  tools: [],
  connection: 'idle',
  error: null,
  connectDiagnostics: null,
  lastUrl: null,
  lastHeaders: undefined,
  selectedToolName: null,
  reuseMcpSession: loadReuseSessionPreference(),

  setReuseMcpSession: (value) => {
    try {
      window.localStorage.setItem(REUSE_SESSION_LS_KEY, value ? 'true' : 'false')
    } catch {
      /* 忽略 */
    }
    set({ reuseMcpSession: value })
  },

  fetchForUrl: async (url, headers) => {
    if (!url) {
      set({
        tools: [],
        connection: 'idle',
        error: null,
        connectDiagnostics: null,
        lastUrl: null,
        lastHeaders: undefined,
        selectedToolName: null,
      })
      return
    }

    set({
      connection: 'loading',
      error: null,
      connectDiagnostics: null,
      lastUrl: url,
      lastHeaders: headers,
      selectedToolName: null,
    })

    try {
      const result = await window.mcpDesktop.fetchToolsList(url, headers, get().reuseMcpSession)
      if (get().lastUrl !== url) return

      if (!result.ok) {
        set({
          connection: 'error',
          error: result.error,
          connectDiagnostics: result.diagnostics ?? null,
          tools: [],
        })
        return
      }
      set({ connection: 'ok', tools: result.tools, error: null, connectDiagnostics: null })
    } catch (e) {
      if (get().lastUrl !== url) return
      const message = e instanceof Error ? e.message : String(e)
      set({
        connection: 'error',
        error: message,
        connectDiagnostics: null,
        tools: [],
      })
    }
  },

  setSelectedTool: (name) => set({ selectedToolName: name }),

  clear: () =>
    set({
      tools: [],
      connection: 'idle',
      error: null,
      connectDiagnostics: null,
      lastUrl: null,
      lastHeaders: undefined,
      selectedToolName: null,
    }),
}))
