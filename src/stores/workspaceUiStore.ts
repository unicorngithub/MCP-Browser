import { create } from 'zustand'
import type { MCPServer } from '@shared/types'
import type { WindowModePreference } from '@shared/windowMode'
import { releaseToolsWorkspaceStore } from './toolsStore'

export const DEFAULT_WORKSPACE_ID = 'ws-default'

type State = {
  /** 与主进程持久化同步；仅「单窗口 / 多标签」模式 */
  windowMode: WindowModePreference
  /** 从左到右标签顺序 */
  workspaceOrder: string[]
  activeWorkspaceId: string
  /** 各工作区当前选中的端点 id */
  selectedServerByWs: Record<string, string | null>
}

type Actions = {
  setWindowMode: (mode: WindowModePreference) => void
  setActiveWorkspace: (id: string) => void
  /** 多标签：新增一页，选中端点与当前活动页相同 */
  addWorkspaceCloneOfActive: () => void
  /** 关闭某一工作区（至少保留一页） */
  removeWorkspace: (workspaceId: string) => void
  setSelectedForWorkspace: (workspaceId: string, serverId: string | null) => void
  selectForActiveWorkspace: (serverId: string | null) => void
  /** 端点列表变化后修正各工作区选中项 */
  pruneSelectionsAfterHydrate: (servers: MCPServer[]) => void
  /** 从多标签切回单窗口：只保留当前活动页 */
  collapseToSingleWorkspace: () => void
}

function newWorkspaceId(): string {
  return `ws-${crypto.randomUUID()}`
}

export const useWorkspaceUiStore = create<State & Actions>((set, get) => ({
  windowMode: 'single',
  workspaceOrder: [DEFAULT_WORKSPACE_ID],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  selectedServerByWs: { [DEFAULT_WORKSPACE_ID]: null },

  setWindowMode: (mode) => set({ windowMode: mode }),

  setActiveWorkspace: (id) => {
    const { workspaceOrder } = get()
    if (!workspaceOrder.includes(id)) return
    set({ activeWorkspaceId: id })
  },

  addWorkspaceCloneOfActive: () => {
    const { workspaceOrder, activeWorkspaceId, selectedServerByWs } = get()
    const nid = newWorkspaceId()
    const copySel = selectedServerByWs[activeWorkspaceId] ?? null
    set({
      workspaceOrder: [...workspaceOrder, nid],
      activeWorkspaceId: nid,
      selectedServerByWs: { ...selectedServerByWs, [nid]: copySel },
    })
  },

  removeWorkspace: (workspaceId) => {
    const { workspaceOrder, activeWorkspaceId, selectedServerByWs } = get()
    if (workspaceOrder.length <= 1) return
    const idx = workspaceOrder.indexOf(workspaceId)
    if (idx < 0) return

    const nextOrder = workspaceOrder.filter((x) => x !== workspaceId)
    const nextSel = { ...selectedServerByWs }
    delete nextSel[workspaceId]
    releaseToolsWorkspaceStore(workspaceId)

    let nextActive = activeWorkspaceId
    if (activeWorkspaceId === workspaceId) {
      nextActive = idx > 0 ? nextOrder[idx - 1]! : nextOrder[0]!
    }

    set({
      workspaceOrder: nextOrder,
      activeWorkspaceId: nextActive,
      selectedServerByWs: nextSel,
    })
  },

  setSelectedForWorkspace: (workspaceId, serverId) =>
    set((s) => ({
      selectedServerByWs: { ...s.selectedServerByWs, [workspaceId]: serverId },
    })),

  selectForActiveWorkspace: (serverId) => {
    const { activeWorkspaceId } = get()
    get().setSelectedForWorkspace(activeWorkspaceId, serverId)
  },

  pruneSelectionsAfterHydrate: (servers) => {
    const ids = new Set(servers.map((x) => x.id))
    const fallback = servers[0]?.id ?? null
    set((s) => {
      const next = { ...s.selectedServerByWs }
      for (const ws of Object.keys(next)) {
        const cur = next[ws]
        if (servers.length === 0) {
          next[ws] = null
        } else if (cur == null || !ids.has(cur)) {
          next[ws] = fallback
        }
      }
      return { selectedServerByWs: next }
    })
  },

  collapseToSingleWorkspace: () => {
    const { activeWorkspaceId, selectedServerByWs, workspaceOrder } = get()
    const sel = selectedServerByWs[activeWorkspaceId] ?? null
    for (const wid of workspaceOrder) {
      if (wid !== DEFAULT_WORKSPACE_ID) releaseToolsWorkspaceStore(wid)
    }
    set({
      workspaceOrder: [DEFAULT_WORKSPACE_ID],
      activeWorkspaceId: DEFAULT_WORKSPACE_ID,
      selectedServerByWs: { [DEFAULT_WORKSPACE_ID]: sel },
    })
  },
}))
