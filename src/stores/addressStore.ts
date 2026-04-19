import { create } from 'zustand'
import type { MCPHttpHeader, MCPServer } from '@shared/types'
import { useWorkspaceUiStore } from './workspaceUiStore'

interface AddressState {
  servers: MCPServer[]
  ready: boolean
  hydrate: () => Promise<void>
  addServer: (name: string, url: string, headers?: MCPHttpHeader[]) => Promise<void>
  updateServer: (id: string, name: string, url: string, headers?: MCPHttpHeader[]) => Promise<void>
  removeServer: (id: string) => Promise<void>
  /** 将某项拖到「插入到 beforeIndex 之前」；beforeIndex === length 表示末尾 */
  reorderServers: (fromIndex: number, beforeIndex: number) => Promise<void>
  /** 用导入列表完全替换本地端点（会持久化） */
  replaceAllServers: (list: MCPServer[]) => Promise<void>
}

async function persist(list: MCPServer[]): Promise<boolean> {
  const r = await window.mcpDesktop.setServers(list)
  if (!r.ok) {
    console.error('[addressStore] 持久化端点列表失败', r.error)
    return false
  }
  return true
}

function normalizePersistedHeaders(headers: MCPHttpHeader[] | undefined): MCPHttpHeader[] {
  if (!headers?.length) return []
  return headers
    .map((x) => ({ name: x.name.trim(), value: x.value }))
    .filter((x) => x.name.length > 0)
}

function patchSelectionsAfterRemove(removedId: string, nextServers: MCPServer[]): void {
  const fallback = nextServers[0]?.id ?? null
  useWorkspaceUiStore.setState((s) => {
    const selMap = { ...s.selectedServerByWs }
    for (const w of Object.keys(selMap)) {
      if (selMap[w] === removedId) selMap[w] = fallback
    }
    return { selectedServerByWs: selMap }
  })
}

function setAllSelections(serverId: string | null): void {
  useWorkspaceUiStore.setState((s) => {
    const selMap = { ...s.selectedServerByWs }
    for (const w of Object.keys(selMap)) {
      selMap[w] = serverId
    }
    return { selectedServerByWs: selMap }
  })
}

export const useAddressStore = create<AddressState>((set, get) => ({
  servers: [],
  ready: false,

  hydrate: async () => {
    try {
      const list = await window.mcpDesktop.getServers()
      set({ servers: list, ready: true })
      useWorkspaceUiStore.getState().pruneSelectionsAfterHydrate(list)
    } catch {
      set({ servers: [], ready: true })
      useWorkspaceUiStore.getState().pruneSelectionsAfterHydrate([])
    }
  },

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
    if (!(await persist(next))) return
    set({ servers: next })
    useWorkspaceUiStore.getState().selectForActiveWorkspace(server.id)
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
    if (!(await persist(next))) return
    set({ servers: next })
  },

  removeServer: async (id) => {
    const servers = get().servers
    const next = servers.filter(s => s.id !== id)
    if (!(await persist(next))) return
    set({ servers: next })
    patchSelectionsAfterRemove(id, next)
  },

  reorderServers: async (fromIndex, beforeIndex) => {
    const servers = get().servers
    const n = servers.length
    if (fromIndex < 0 || fromIndex >= n) return
    if (beforeIndex < 0 || beforeIndex > n) return
    if (fromIndex === beforeIndex) return
    if (fromIndex + 1 === beforeIndex) return

    const next = [...servers]
    const [item] = next.splice(fromIndex, 1)
    const insertAt = fromIndex < beforeIndex ? beforeIndex - 1 : beforeIndex
    next.splice(insertAt, 0, item)
    if (!(await persist(next))) return
    set({ servers: next })
  },

  replaceAllServers: async (list) => {
    const stripped = list.map(stripReuseField)
    if (!(await persist(stripped))) return
    set({ servers: stripped })
    const first = stripped[0]?.id ?? null
    setAllSelections(first)
  },
}))

function stripReuseField(s: MCPServer): MCPServer {
  const { reuseMcpSession: _r, ...rest } = s
  return rest
}
