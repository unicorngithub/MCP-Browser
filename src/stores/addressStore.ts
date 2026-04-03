import { create } from 'zustand'
import type { MCPServer } from '@shared/types'

interface AddressState {
  servers: MCPServer[]
  selectedId: string | null
  ready: boolean
  hydrate: () => Promise<void>
  select: (id: string | null) => void
  addServer: (name: string, url: string) => Promise<void>
  updateServer: (id: string, name: string, url: string) => Promise<void>
  removeServer: (id: string) => Promise<void>
}

async function persist(list: MCPServer[]) {
  await window.mcpDesktop.setServers(list)
}

export const useAddressStore = create<AddressState>((set, get) => ({
  servers: [],
  selectedId: null,
  ready: false,

  hydrate: async () => {
    try {
      const list = await window.mcpDesktop.getServers()
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt)
      const prev = get().selectedId
      const selectedId =
        prev && sorted.some(s => s.id === prev) ? prev : sorted[0]?.id ?? null
      set({ servers: sorted, ready: true, selectedId })
    } catch {
      set({ servers: [], ready: true, selectedId: null })
    }
  },

  select: (id) => set({ selectedId: id }),

  addServer: async (name, url) => {
    const trimmedUrl = url.trim()
    const server: MCPServer = {
      id: crypto.randomUUID(),
      name: name.trim() || trimmedUrl,
      url: trimmedUrl,
      createdAt: Date.now(),
    }
    const next = [server, ...get().servers]
    await persist(next)
    set({ servers: next, selectedId: server.id })
  },

  updateServer: async (id, name, url) => {
    const trimmedUrl = url.trim()
    const next = get().servers.map(s =>
      s.id === id
        ? {
            ...s,
            name: name.trim() || trimmedUrl,
            url: trimmedUrl,
          }
        : s,
    )
    await persist(next)
    set({ servers: next })
  },

  removeServer: async (id) => {
    const { servers, selectedId } = get()
    const next = servers.filter(s => s.id !== id)
    await persist(next)
    const newSel = selectedId === id ? next[0]?.id ?? null : selectedId
    set({ servers: next, selectedId: newSel })
  },
}))
