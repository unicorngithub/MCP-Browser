import { create } from 'zustand'
import type { MCPHttpHeader, MCPServer } from '@shared/types'

interface AddressState {
  servers: MCPServer[]
  selectedId: string | null
  ready: boolean
  hydrate: () => Promise<void>
  select: (id: string | null) => void
  addServer: (name: string, url: string, headers?: MCPHttpHeader[]) => Promise<void>
  updateServer: (id: string, name: string, url: string, headers?: MCPHttpHeader[]) => Promise<void>
  removeServer: (id: string) => Promise<void>
  /** 用导入列表完全替换本地端点（会持久化） */
  replaceAllServers: (list: MCPServer[]) => Promise<void>
}

async function persist(list: MCPServer[]) {
  await window.mcpDesktop.setServers(list)
}

function normalizePersistedHeaders(headers: MCPHttpHeader[] | undefined): MCPHttpHeader[] {
  if (!headers?.length) return []
  return headers
    .map((x) => ({ name: x.name.trim(), value: x.value }))
    .filter((x) => x.name.length > 0)
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

  addServer: async (name, url, headers) => {
    const trimmedUrl = url.trim()
    const h = normalizePersistedHeaders(headers)
    const server: MCPServer = {
      id: crypto.randomUUID(),
      name: name.trim() || trimmedUrl,
      url: trimmedUrl,
      createdAt: Date.now(),
      ...(h.length ? { headers: h } : {}),
    }
    const next = [server, ...get().servers]
    await persist(next)
    set({ servers: next, selectedId: server.id })
  },

  updateServer: async (id, name, url, headers) => {
    const trimmedUrl = url.trim()
    const h = normalizePersistedHeaders(headers)
    const next = get().servers.map(s => {
      if (s.id !== id) return s
      const { headers: _old, ...rest } = s
      return {
        ...rest,
        name: name.trim() || trimmedUrl,
        url: trimmedUrl,
        ...(h.length ? { headers: h } : {}),
      }
    })
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

  replaceAllServers: async (list) => {
    const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt)
    await persist(sorted)
    set({ servers: sorted, selectedId: sorted[0]?.id ?? null })
  },
}))
