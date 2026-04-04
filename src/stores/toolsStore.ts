import { create } from 'zustand'
import type { McpConnectDiagnostics, MCPHttpHeader, MCPTool } from '@shared/types'

type ConnState = 'idle' | 'loading' | 'ok' | 'error'

interface ToolsState {
  tools: MCPTool[]
  connection: ConnState
  error: string | null
  connectDiagnostics: McpConnectDiagnostics | null
  lastUrl: string | null
  lastHeaders: MCPHttpHeader[] | undefined
  selectedToolName: string | null
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
      const result = await window.mcpDesktop.fetchToolsList(url, headers)
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
