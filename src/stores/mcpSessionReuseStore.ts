import { create } from 'zustand'

/**
 * 「复用 MCP 会话」开关：仅内存，不落盘；每次启动应用均为关闭。
 * 按「工作区 × 端点」隔离：同一端点在不同工作区可各自开关。
 */
interface McpSessionReuseState {
  /** workspaceId -> serverId -> 是否复用；未出现视为 false */
  reuseByWorkspace: Record<string, Record<string, boolean>>
  setServerReuseMcpSession: (workspaceId: string, serverId: string, reuse: boolean) => void
  isReuseMcpSession: (
    workspaceId: string | null | undefined,
    serverId: string | null | undefined,
  ) => boolean
}

export const useMcpSessionReuseStore = create<McpSessionReuseState>((set, get) => ({
  reuseByWorkspace: {},
  setServerReuseMcpSession: (workspaceId, serverId, reuse) =>
    set((s) => {
      const prevInner = s.reuseByWorkspace[workspaceId] ?? {}
      const nextInner = { ...prevInner }
      if (reuse) nextInner[serverId] = true
      else delete nextInner[serverId]

      const { [workspaceId]: _drop, ...restOuter } = s.reuseByWorkspace
      if (Object.keys(nextInner).length === 0) {
        return { reuseByWorkspace: restOuter }
      }
      return { reuseByWorkspace: { ...restOuter, [workspaceId]: nextInner } }
    }),
  isReuseMcpSession: (workspaceId, serverId) => {
    if (!workspaceId || !serverId) return false
    return get().reuseByWorkspace[workspaceId]?.[serverId] === true
  },
}))
