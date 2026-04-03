import { create } from 'zustand'
import type { MCPTool } from '@shared/types'

type ConnState = 'idle' | 'loading' | 'ok' | 'error'

interface ToolsState {
  tools: MCPTool[]
  connection: ConnState
  error: string | null
  lastUrl: string | null
  selectedToolName: string | null
  fetchForUrl: (url: string | null) => Promise<void>
  setSelectedTool: (name: string | null) => void
  clear: () => void
}

export const useToolsStore = create<ToolsState>((set) => ({
  tools: [],
  connection: 'idle',
  error: null,
  lastUrl: null,
  selectedToolName: null,

  fetchForUrl: async (url) => {
    if (!url) {
      set({
        tools: [],
        connection: 'idle',
        error: null,
        lastUrl: null,
        selectedToolName: null,
      })
      return
    }

    set({ connection: 'loading', error: null, lastUrl: url, selectedToolName: null })

    try {
      const result = await window.mcpDesktop.fetchToolsList(url)
      if (!result.ok) {
        set({ connection: 'error', error: result.error, tools: [] })
        return
      }
      set({ connection: 'ok', tools: result.tools, error: null })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set({ connection: 'error', error: message, tools: [] })
    }
  },

  setSelectedTool: (name) => set({ selectedToolName: name }),

  clear: () =>
    set({
      tools: [],
      connection: 'idle',
      error: null,
      lastUrl: null,
      selectedToolName: null,
    }),
}))
