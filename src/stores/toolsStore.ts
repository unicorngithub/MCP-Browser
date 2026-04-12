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

/** HTTP/SSE 时侧栏展示的链路状态（与 Streamable 的「复用会话」开关位置对应） */
export type SseLinkUiState = 'off' | 'connecting' | 'ready' | 'error'

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
  /** 仅 HTTP/SSE 传输时有效：当前是否保持与列表拉取同一条 SSE */
  sseLinkState: SseLinkUiState
  selectedToolName: string | null
  setMcpHttpTransport: (transport: McpHttpTransport) => void
  setSseLinkState: (state: SseLinkUiState) => void
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
  sseLinkState: 'off',
  selectedToolName: null,

  setMcpHttpTransport: (transport) => set({ mcpHttpTransport: transport }),

  setSseLinkState: (state) => set({ sseLinkState: state }),

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
        sseLinkState: 'off',
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
      sseLinkState: httpTransport === 'sse' ? 'connecting' : 'off',
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
          sseLinkState: httpTransport === 'sse' ? 'error' : 'off',
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
        sseLinkState:
          httpTransport === 'sse' ? (result.sseHeld ? 'ready' : 'off') : 'off',
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
        sseLinkState: httpTransport === 'sse' ? 'error' : 'off',
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
      sseLinkState: 'off',
    }),
}))
