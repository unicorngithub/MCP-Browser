import { create } from 'zustand'
import type {
  McpConnectDiagnostics,
  McpErrorI18n,
  MCPHttpHeader,
  MCPTool,
  McpHttpTransport,
  McpToolCallHttpTrace,
} from '@shared/types'

type ConnState = 'idle' | 'loading' | 'ok' | 'error'

interface ToolsState {
  tools: MCPTool[]
  connection: ConnState
  error: string | null
  /** 与 error 同一条提示的 i18n 形式；存在时界面用当前语言 t() 展示 */
  errorI18n: McpErrorI18n | null
  connectDiagnostics: McpConnectDiagnostics | null
  /** 拉取工具列表失败时，失败步骤的 HTTP 请求/响应（若有） */
  connectHttpTrace: McpToolCallHttpTrace | null
  lastUrl: string | null
  lastHeaders: MCPHttpHeader[] | undefined
  lastReuseMcpSession: boolean
  /** 主界面选择的 MCP HTTP 传输（不写入端点配置） */
  mcpHttpTransport: McpHttpTransport
  selectedToolName: string | null
  setMcpHttpTransport: (transport: McpHttpTransport) => void
  fetchForUrl: (
    url: string | null,
    headers?: MCPHttpHeader[],
    reuseMcpSession?: boolean,
  ) => Promise<void>
  setSelectedTool: (name: string | null) => void
  clear: () => void
}

export const useToolsStore = create<ToolsState>((set, get) => ({
  tools: [],
  connection: 'idle',
  error: null,
  errorI18n: null,
  connectDiagnostics: null,
  connectHttpTrace: null,
  lastUrl: null,
  lastHeaders: undefined,
  lastReuseMcpSession: false,
  mcpHttpTransport: 'streamable-http',
  selectedToolName: null,

  setMcpHttpTransport: (transport) => set({ mcpHttpTransport: transport }),

  fetchForUrl: async (url, headers, reuseMcpSession = false) => {
    const httpTransport = get().mcpHttpTransport

    if (!url) {
      set({
        tools: [],
        connection: 'idle',
        error: null,
        errorI18n: null,
        connectDiagnostics: null,
        connectHttpTrace: null,
        lastUrl: null,
        lastHeaders: undefined,
        lastReuseMcpSession: false,
        selectedToolName: null,
      })
      return
    }

    set({
      connection: 'loading',
      error: null,
      errorI18n: null,
      connectDiagnostics: null,
      connectHttpTrace: null,
      lastUrl: url,
      lastHeaders: headers,
      lastReuseMcpSession: reuseMcpSession,
      selectedToolName: null,
    })

    try {
      const result = await window.mcpDesktop.fetchToolsList(url, headers, reuseMcpSession, httpTransport)
      if (get().lastUrl !== url) return

      if (!result.ok) {
        set({
          connection: 'error',
          error: result.error,
          errorI18n: result.errorI18n ?? null,
          connectDiagnostics: result.diagnostics ?? null,
          connectHttpTrace: result.httpTrace ?? null,
          tools: [],
        })
        return
      }
      set({
        connection: 'ok',
        tools: result.tools,
        error: null,
        errorI18n: null,
        connectDiagnostics: null,
        connectHttpTrace: null,
      })
    } catch (e) {
      if (get().lastUrl !== url) return
      const message = e instanceof Error ? e.message : String(e)
      set({
        connection: 'error',
        error: message,
        errorI18n: null,
        connectDiagnostics: null,
        connectHttpTrace: null,
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
      errorI18n: null,
      connectDiagnostics: null,
      connectHttpTrace: null,
      lastUrl: null,
      lastHeaders: undefined,
      lastReuseMcpSession: false,
      selectedToolName: null,
    }),
}))
