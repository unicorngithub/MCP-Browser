import { createStore, type StoreApi } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { useWorkspaceId } from '@/context/WorkspaceContext'
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

export interface ToolsState {
  tools: MCPTool[]
  connection: ConnState
  error: string | null
  errorI18n: McpErrorI18n | null
  connectDiagnostics: McpConnectDiagnostics | null
  connectHttpTrace: McpToolCallHttpTrace | null
  lastUrl: string | null
  lastHeaders: MCPHttpHeader[] | undefined
  lastReuseMcpSession: boolean
  mcpHttpTransport: McpHttpTransport
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

function buildToolsState(
  set: (partial: Partial<ToolsState> | ((s: ToolsState) => Partial<ToolsState>)) => void,
  get: () => ToolsState,
): ToolsState {
  return {
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
  }
}

const toolsStoreByWorkspace = new Map<string, StoreApi<ToolsState>>()

export function getToolsStore(workspaceId: string): StoreApi<ToolsState> {
  let st = toolsStoreByWorkspace.get(workspaceId)
  if (!st) {
    st = createStore<ToolsState>((set, get) => buildToolsState(set, get))
    toolsStoreByWorkspace.set(workspaceId, st)
  }
  return st
}

/** 关闭工作区标签时释放对应 tools 状态，避免 Map 泄漏 */
export function releaseToolsWorkspaceStore(workspaceId: string): void {
  toolsStoreByWorkspace.delete(workspaceId)
}

/** 当前工作区（由 WorkspaceProvider 提供）的 MCP 工具列表与连接状态 */
export function useToolsStore(): ToolsState
export function useToolsStore<T>(selector: (s: ToolsState) => T): T
export function useToolsStore<T>(selector?: (s: ToolsState) => T): ToolsState | T {
  const workspaceId = useWorkspaceId()
  const store = getToolsStore(workspaceId)
  if (selector) return useStore(store, selector)
  return useStore(store)
}
